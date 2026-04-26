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
        
        // Pedimos para a IA gerar o texto da mensagem E o prompt da imagem em formato JSON
        // Agora usamos REST para texto também, para garantir o uso da versão v1 (estável)
        let aiResponse = { message: type === 'morning' ? "Bom dia! ☀️" : "Boa noite! 🌙", image_prompt: prompt };
        
        try {
            console.log("Solicitando texto para a IA (v1)...");
            const textUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const textResponse = await axios.post(textUrl, {
                contents: [{
                    parts: [{
                        text: `Baseado no contexto: "${prompt}", gere uma mensagem carinhosa para WhatsApp e um prompt detalhado em inglês para geração de imagem. 
                        Responda APENAS com um JSON no formato:
                        {
                          "message": "texto da mensagem aqui com emojis",
                          "image_prompt": "detailed image description in english"
                        }`
                    }]
                }]
            }, { timeout: 15000 });

            if (textResponse.data && textResponse.data.candidates && textResponse.data.candidates[0].content) {
                const rawText = textResponse.data.candidates[0].content.parts[0].text;
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    aiResponse = JSON.parse(jsonMatch[0]);
                }
            }
        } catch (e) {
            console.error("Erro ao processar texto da IA (REST):", e.response?.data || e.message);
        }

        console.log("AI Message:", aiResponse.message);
        console.log("AI Image Prompt:", aiResponse.image_prompt);

        const enhancedPrompt = aiResponse.image_prompt;
        const finalCaption = aiResponse.message;

        // Agora vamos chamar a API do Imagen 3 diretamente via REST
        try {
            console.log("Chamando Imagen 3 para desenhar a imagem...");
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_API_KEY}`;
            
            const response = await axios.post(imagenUrl, {
                instances: [
                    { prompt: enhancedPrompt }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "1:1"
                }
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos de limite para a imagem
            });

            if (response.data && response.data.predictions && response.data.predictions.length > 0) {
                const base64Image = response.data.predictions[0].bytesBase64Encoded;
                if (base64Image) {
                    console.log("Imagem gerada com sucesso pelo Imagen 3!");
                    const buffer = Buffer.from(base64Image, 'base64');
                    // Salva no cache diário
                    fs.writeFileSync(cacheFile, buffer);
                    fs.writeFileSync(cacheTextFile, finalCaption);
                    return { image: buffer, caption: finalCaption };
                }
            }
            console.log("Resposta do Imagen 3 não continha a imagem esperada.");
            return { image: null, caption: finalCaption };
        } catch (imgError) {
            console.error("Erro ao gerar imagem com Imagen 3:", imgError.response?.data || imgError.message);
            return { image: null, caption: finalCaption };
        }
    } catch (error) {
        console.error("Erro geral na geração:", error);
        throw error;
    }
}

module.exports = { generateImage };
