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
        let aiResponse = { message: type === 'morning' ? "Bom dia! ☀️" : "Boa noite! 🌙", image_prompt: prompt };
        
        try {
            console.log("Consultando modelos disponíveis para sua chave...");
            const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
            const modelsRes = await axios.get(modelsUrl, { timeout: 10000 });
            const availableModels = modelsRes.data.models || [];
            
            // Procura o melhor modelo de texto disponível
            const textModelObj = availableModels.find(m => m.name.includes('gemini-1.5-flash')) || 
                                 availableModels.find(m => m.name.includes('gemini-1.5-pro')) || 
                                 availableModels.find(m => m.name.includes('gemini-pro')) ||
                                 availableModels.find(m => m.name.includes('gemini-1.0-pro'));
            
            // Procura o modelo de imagem disponível
            const imageModelObj = availableModels.find(m => m.name.includes('imagen-3.0-generate'));

            if (textModelObj) {
                console.log(`Modelo de texto selecionado: ${textModelObj.name}`);
                const textUrl = `https://generativelanguage.googleapis.com/v1beta/${textModelObj.name}:generateContent?key=${process.env.GEMINI_API_KEY}`;
                
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
                }, { timeout: 60000 });

                if (textResponse.data && textResponse.data.candidates && textResponse.data.candidates[0].content) {
                    const rawText = textResponse.data.candidates[0].content.parts[0].text;
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiResponse = JSON.parse(jsonMatch[0]);
                    }
                }
            } else {
                console.warn("Nenhum modelo de texto Gemini suportado foi encontrado para esta chave.");
            }

            console.log("AI Message:", aiResponse.message);
            console.log("AI Image Prompt:", aiResponse.image_prompt);

            const enhancedPrompt = aiResponse.image_prompt;
            const finalCaption = aiResponse.message;

            // Se o usuário tem acesso ao Imagen 3, geramos a imagem
            if (imageModelObj) {
                console.log(`Chamando modelo de imagem: ${imageModelObj.name}...`);
                const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/${imageModelObj.name}:predict?key=${process.env.GEMINI_API_KEY}`;
                
                const response = await axios.post(imagenUrl, {
                    instances: [
                        { prompt: enhancedPrompt }
                    ],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1"
                    }
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 45000 
                });

                if (response.data && response.data.predictions && response.data.predictions.length > 0) {
                    const base64Image = response.data.predictions[0].bytesBase64Encoded;
                    if (base64Image) {
                        console.log("Imagem gerada com sucesso pelo Imagen 3!");
                        const buffer = Buffer.from(base64Image, 'base64');
                        fs.writeFileSync(cacheFile, buffer);
                        fs.writeFileSync(cacheTextFile, finalCaption);
                        return { image: buffer, caption: finalCaption };
                    }
                }
                console.log("Resposta do Imagen 3 não continha a imagem esperada.");
            } else {
                console.warn("Esta chave API não possui permissão para usar o gerador de imagens (Imagen 3). Enviando apenas texto.");
            }
            return { image: null, caption: finalCaption };

        } catch (e) {
            console.error("Erro na comunicação com a API do Google (REST):", e.response?.data || e.message);
            return { image: null, caption: aiResponse.message };
        }
    } catch (error) {
        console.error("Erro geral na geração:", error);
        throw error;
    }
}

module.exports = { generateImage };
