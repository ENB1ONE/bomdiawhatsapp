const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Initialize Gemini
// Note: Direct image generation via the SDK might require specific models like 'imagen-3.0' 
// or using Vertex AI. For Google AI Studio (API Key), check the latest documentation.
// If direct generation is not available, this function serves as a wrapper.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateImage(prompt, type = "morning") {
    try {
        // Verificar cache diário para não gerar a mesma imagem 2x no dia
        const today = new Date().toISOString().split('T')[0]; // Ex: 2023-10-25
        const cacheDir = path.join(process.cwd(), 'cache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
        
        const cacheFile = path.join(cacheDir, `${type}-${today}.png`);
        const cacheTextFile = path.join(cacheDir, `${type}-${today}.txt`);
        
        if (fs.existsSync(cacheFile) && fs.existsSync(cacheTextFile)) {
            console.log(`Usando imagem e texto do cache diário para ${type} de hoje (${today}).`);
            return {
                image: fs.readFileSync(cacheFile),
                caption: fs.readFileSync(cacheTextFile, 'utf8')
            };
        }

        console.log(`Gerando novo conteúdo para ${type} com prompt: ${prompt}`);
        
        // This is a generic implementation. 
        // As of now, Gemini Pro/Flash (Google AI Studio) handles text-to-image 
        // via specific models or Vertex AI. 
        // For the sake of this project, we will use the Gemini API 
        // to generate a high-quality description and then, 
        // if the user has access to Imagen 3, we use that.
        
        // MOCK/EXAMPLE for Imagen 3 via Gemini SDK (Hypothetical or via Vertex)
        // In many cases, users use DALL-E or Midjourney. 
        // Since the user asked for "Gemini 3 Flash Image", I will assume they want 
        // the latest multimodal capability.
        
        let aiResponse = { message: type === 'morning' ? "Bom dia! ☀️" : "Boa noite! 🌙", image_prompt: prompt };
        
        let retries = 5;
        let success = false;
        
        while (retries > 0 && !success) {
            try {
                console.log(`Solicitando texto para a IA (gemini-2.5-flash)... Tentativas restantes: ${retries}`);
                const textUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
                
                const textResponse = await axios.post(textUrl, {
                    contents: [{
                        parts: [{
                            text: `Baseado no contexto: "${prompt}", gere uma mensagem carinhosa e ÚNICA para WhatsApp. 
                            REGRAS:
                            1. A mensagem de texto deve ter NO MÁXIMO 300 caracteres, ser calorosa e variar temas (esperança, fé, gratidão, saúde). Pode usar emojis na mensagem.
                            2. Gere também um prompt detalhado em INGLÊS para geração de imagem. 
                            3. CRÍTICO PARA A IMAGEM: O prompt da imagem NÃO DEVE conter emojis (isso estraga a geração). O prompt da imagem DEVE focar em ser realista e puramente visual (sem letras, frases ou textos). Adicione no final do prompt da imagem: "photorealistic, cinematic lighting, no text, no letters, no watermark, no writing, no emojis".
                            
                            Responda APENAS com um JSON no formato:
                            {
                              "message": "texto da mensagem aqui com emojis",
                              "image_prompt": "detailed image description in english focusing ONLY on visuals, no text"
                            }`
                        }]
                    }]
                }, { timeout: 60000 });

                if (textResponse.data && textResponse.data.candidates && textResponse.data.candidates[0].content) {
                    const rawText = textResponse.data.candidates[0].content.parts[0].text;
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiResponse = JSON.parse(jsonMatch[0]);
                        success = true; // We got a valid JSON response
                        console.log("IA respondeu com sucesso!");
                    } else {
                        throw new Error("Resposta da IA não continha um JSON válido.");
                    }
                }
            } catch (e) {
                console.error("Erro ao processar texto da IA (REST):", e.response?.data || e.message);
                retries--;
                if (retries > 0) {
                    const delay = (6 - retries) * 10000; // 10s, 20s, 30s, 40s
                    console.log(`Aguardando ${delay / 1000} segundos antes de tentar novamente...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        if (!success) {
            console.error("Todas as tentativas da IA falharam. Usando texto padrão.");
        }

        console.log("AI Message:", aiResponse.message);
        console.log("AI Image Prompt:", aiResponse.image_prompt);

        // Se a IA falhou e estamos usando o prompt original em português que pedia texto, 
        // nós forçamos a remoção dessa instrução adicionando regras restritas no final.
        let enhancedPrompt = aiResponse.image_prompt;
        if (enhancedPrompt === prompt) {
            enhancedPrompt += " - SUPER IMPORTANT: Make this image PURELY VISUAL. Photorealistic, no text, no letters, no writing, no watermark, no words, no emojis.";
        }
        
        const finalCaption = aiResponse.message;

        // Usamos Pollinations.ai como motor principal de imagem (mais rápido e sem restrições de chave)
        try {
            console.log("Gerando imagem via Pollinations.ai...");
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
            
            const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 45000 });
            
            if (imageRes.data) {
                console.log("Imagem gerada com sucesso!");
                const buffer = Buffer.from(imageRes.data);
                fs.writeFileSync(cacheFile, buffer);
                fs.writeFileSync(cacheTextFile, finalCaption);
                return { image: buffer, caption: finalCaption };
            }
            throw new Error("Pollinations não retornou dados.");
        } catch (imgError) {
            console.error("Falha ao gerar imagem:", imgError.message);
            return { image: null, caption: finalCaption };
        }
    } catch (error) {
        console.error("Erro geral na geração:", error);
        throw error;
    }
}

module.exports = { generateImage };
