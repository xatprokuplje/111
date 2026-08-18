import { Groq } from "../api/Groq.js";
import { Gemini } from "../api/Gemini.js";

// Podrazumevano uputstvo modelu - kratak, chat-prijateljski odgovor na
// jeziku chata, bez markdown formatiranja (xat chat ga ne renderuje).
const SYSTEM_PROMPT = 'Ti si AI asistent u xat.com chat sobi. Odgovaraj kratko '
    + '(maks. 2-3 rečenice), jasno i na jeziku na kom ti je postavljeno pitanje. '
    + 'Ne koristi markdown (zvezdice, tarabe i sl.) jer se ne prikazuje u chatu.';

/**
 * Orkestrira pozive ka AI provajderima sa "fallback" lancem: prvo se
 * redom probaju 3 Groq modela (brži, veći besplatni limiti), pa ako svi
 * "pucaju" (greška, limit, prazan odgovor), redom se probaju 3 Gemini
 * modela. Prvi model koji uspešno odgovori - taj odgovor se vraća.
 */
export class AiService {
    /**
     * @param {import('./state.js').BotState} state
     */
    constructor (state) {
        this.state = state;
        this.groq = new Groq(state);
        this.gemini = new Gemini(state);
    }

    /**
     * Pokušava da dobije odgovor redom kroz sve konfigurisane modele.
     * @param {string} prompt Korisnikovo pitanje/poruka.
     * @return {Promise<{text: string, provider: string, model: string}>}
     * @throws {Error} Ako baš SVI modeli (Groq + Gemini) ne uspeju.
     */
    async ask (prompt) {
        const attempts = [
            ...this.groq.models.map((model) => ({ provider: 'groq', model })),
            ...this.gemini.models.map((model) => ({ provider: 'gemini', model })),
        ];

        const errors = [];

        for (const { provider, model } of attempts) {
            try {
                const client = provider === 'groq' ? this.groq : this.gemini;
                const text = await client.ask(model, prompt, SYSTEM_PROMPT);
                return { text, provider, model };
            } catch (error) {
                const reason = error?.response?.data?.error?.message || error.message;
                errors.push(`${provider}/${model}: ${reason}`);
            }
        }

        throw new Error(`Svi AI modeli su odbili zahtev:\n${errors.join('\n')}`);
    }
}
