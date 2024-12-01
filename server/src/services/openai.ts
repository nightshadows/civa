import OpenAI from "openai";
import { config } from '../config';

export async function askOpenAI(
    content: string,
    model: string = "gpt-4o-mini"
): Promise<string> {
    if (config.openai.apiKey) {
        try {
            const openai = new OpenAI({
                organization: config.openai.organization,
                apiKey: config.openai.apiKey
            });

            const completion = await openai.chat.completions.create({
                model,
                messages: [
                    {"role": "user", "content": content}
                ]
            });

            if (completion.choices[0]?.message?.content) {
                return completion.choices[0].message.content;
            }
        } catch (error) {
            console.error('OpenAI API Error:', error);
        }
    }

    return '';
}