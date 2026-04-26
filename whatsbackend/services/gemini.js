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
        console.log(`Generating image for ${type} with prompt: ${prompt}`);
        
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
        
        // Usando o gemini-pro pois ele tem disponibilidade global garantida
        // em todas as chaves e regiões.
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Timeout de 10 segundos para a IA não travar o robô
        const smartPromptResult = await Promise.race([
            model.generateContent(`Crie um prompt detalhado em inglês para geração de imagem baseado em: ${prompt}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Gemini')), 10000))
        ]);

        const enhancedPrompt = smartPromptResult.response.text();
        console.log("Enhanced Prompt:", enhancedPrompt);

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
                    return Buffer.from(base64Image, 'base64');
                }
            }
            console.log("Resposta do Imagen 3 não continha a imagem esperada.");
            return null;
        } catch (imgError) {
            console.error("Erro ao gerar imagem com Imagen 3:", imgError.response?.data || imgError.message);
            return null; // Retorna nulo para o sistema usar o fallback de texto
        }
    } catch (error) {
        console.error("Erro geral na geração:", error);
        throw error;
    }
}

module.exports = { generateImage };
