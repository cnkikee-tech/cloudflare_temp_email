import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { routePath } from 'hono/route';
import i18n from '../i18n';
import { getMailProcessingProviderForAddress, isMailProcessingLanguage, MAX_MAIL_PROCESSING_INPUT_LENGTH, summarizeMail, translateMail, type MailProcessingProvider } from '../mail_ai_processing';

type MailProcessingRequest = { subject?: unknown; text?: unknown; html?: unknown; targetLanguage?: unknown };
type MailProcessingIntent = {
    input: string;
    run: (provider: MailProcessingProvider, locale: string, env: Bindings) => Promise<object>;
};

const limitBody = bodyLimit({
    maxSize: 96 * 1024,
    onError: c => c.text(i18n.getMessagesbyContext(c).MailProcessingTooLongMsg, 413),
});

function prepareSummary(subject: string, { text, html }: MailProcessingRequest): MailProcessingIntent | undefined {
    if (html !== undefined || typeof text !== 'string') return;
    const body = text.trim();
    const input = subject && body ? `Subject: ${subject}\n\n${body}` : body;
    return {
        input,
        run: (provider, locale, env) => summarizeMail(provider, input, locale, env.MAIL_PROCESSING_SUMMARY_PROMPT),
    };
}

function prepareTranslation(subject: string, { text, html, targetLanguage }: MailProcessingRequest): MailProcessingIntent | undefined {
    if (targetLanguage !== undefined && !isMailProcessingLanguage(targetLanguage)) return;
    if (html !== undefined && (typeof html !== 'string' || text !== undefined)) return;
    if (html === undefined && typeof text !== 'string') return;
    const plainText = typeof text === 'string' ? text.trim() : '';
    const mail = typeof html === 'string' ? { subject, html: html.trim() } : { subject, text: plainText };
    const input = (mail.html ?? (mail.text || subject)) ? JSON.stringify(mail) : '';
    return {
        input,
        run: (provider, locale, env) => translateMail(provider, input, mail, targetLanguage || locale, env.MAIL_PROCESSING_TRANSLATION_PROMPT),
    };
}

function mailProcessingHandler(prepare: (subject: string, body: MailProcessingRequest) => MailProcessingIntent | undefined) {
    return async (c: Context<HonoCustomType>): Promise<Response> => {
        const msgs = i18n.getMessagesbyContext(c);
        const { address } = c.get('jwtPayload');
        const provider = await getMailProcessingProviderForAddress(c, address);
        if (!provider) return c.text(msgs.MailProcessingDisabledMsg, 403);

        const mailId = Number(c.req.param('mail_id'));
        if (!Number.isSafeInteger(mailId) || mailId < 1) return c.text(msgs.InvalidMailIdMsg, 400);
        const body = await c.req.json<MailProcessingRequest | null>();
        if (typeof body?.subject !== 'string') return c.text(msgs.InvalidRequestBodyMsg, 400);
        const intent = prepare(body.subject.trim(), body);
        if (!intent) return c.text(msgs.InvalidRequestBodyMsg, 400);

        const exists = await c.env.DB.prepare('SELECT 1 FROM raw_mails WHERE id = ? AND address = ?')
            .bind(mailId, address).first();
        if (!exists) return c.text(msgs.MailProcessingNotFoundMsg, 404);

        if (!intent.input) return c.text(msgs.MailProcessingEmptyMsg, 422);
        if (intent.input.length > MAX_MAIL_PROCESSING_INPUT_LENGTH) return c.text(msgs.MailProcessingTooLongMsg, 413);

        const reqIp = c.req.header('cf-connecting-ip');
        if (reqIp && c.env.RATE_LIMITER) {
            const { success } = await c.env.RATE_LIMITER.limit({ key: `${routePath(c)}|${reqIp}` });
            if (!success) return c.text(`IP=${reqIp} Rate limit exceeded for ${c.req.path}`, 429);
        }

        try {
            const locale = c.get('lang') || c.env.DEFAULT_LANG || 'en';
            const result = await intent.run(provider, locale, c.env);
            return c.json(result, 200, { 'Cache-Control': 'no-store' });
        } catch {
            return c.text(msgs.MailProcessingFailedMsg, 502);
        }
    };
}

export default {
    limitBody,
    summarize: mailProcessingHandler(prepareSummary),
    translate: mailProcessingHandler(prepareTranslation),
};
