import "dotenv/config";
import { Chat, genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/google-genai";
import { ChatInputSchema, ChatOutputSchema, ChatOutput, ChatInput } from "./chat-model";
import { ENUM_STATUS_CODES_FAILURE, ENUM_STATUS_CODES_SUCCESS } from "../../../libs/status-codes-enum";
import { Result } from "../../../libs/Result";
import { geminiServiceConfig } from "../../config/config";
import chatRepository from "./chat-repository";
import { WhatsappRawValue } from "../whatsapp/whatsapp-model";
import whatsappService from "../whatsapp/whatsapp-service";
import { UserData } from "../user/user-model";
import userService from "../user/user-service";
import { ImageOutput } from "../gemini/gemini-model";
import geminiService from "../gemini/gemini-service";
import mediaService from "../media/media-service";
import { MediaData } from "../media/media-model";

const ai = genkit({
    plugins: [googleAI({ apiKey: geminiServiceConfig.GEMINI_API_KEY })],
    model: googleAI.model("gemini-3.1-flash-lite-preview"),
});

interface IChatService {
    chat(input: WhatsappRawValue): Promise<Result<ChatOutput>>;
}

class ChatService implements IChatService {
    public readonly chatFlow = ai.defineFlow(
        {
            name: "chatFlow",
            inputSchema: ChatInputSchema,
            outputSchema: ChatOutputSchema,
        },
        async ({ mobile_no, created_by, message, media_url, media_name }) => {
            // Get variables to parse into Gemini 3.1 for contextual chat
            // Chat History
            const chatHistory = (await chatRepository.getChatHistory(mobile_no, created_by)) ?? [];
            const latestHistory = chatHistory.slice(-16);
            const messages = latestHistory.map((item) => {
                const contentParts: any[] = [];

                // Add text
                if (item.message) {
                    contentParts.push({ text: item.message });
                }

                // Add media
                if (item.media_url) {
                    contentParts.push({
                        media: {
                            url: item.media_url,
                            contentType: this.getContentType(item.media_url),
                        },
                    });
                }

                return {
                    role: item.role,
                    content: contentParts,
                };
            });

            // System Prompt
            const systemPrompt = `
                Based on the chat history and newest message from the user, return the following in a contextual manner.

                {
                    vertexOutput: 
                        - You may leave this unset if the question or request from the user does not require information regarding paddy plant diseases, otherwise set to one of the following:
                            1. JSON: The user requests for a solution or timeline-based plan
                            2. TEXT: The user simply wants feedback on something
                            
                    prompt:
                        - You may again leave this empty if vertexOutput was left empty, as this query will be sent to Vertex Search to look up information regarding user queries.
                        - You are to generate the contextualized query for Vertex based on users previous messages. 

                    message:
                        - The reply you will give back to the user, mandatory field.
                    
                    For example, if users asked a question regarding stem rot previously, and the latest message is asking for solutions, you may set it so:
                        vertexOutput: "JSON",
                        prompt: "Provide a 7-day solution plan to solve stem rot in a paddy field." (this will be sent directly to Vertex Search)
                        message: "Please wait a moment as I generate a timeline solution for you..."
                }
            `;

            // Separate handling of media and text

            // Parse data into Gemini 3.1
            const { output } = await ai.generate({
                system: systemPrompt,
                messages: messages,
                output: {
                    schema: ChatOutputSchema,
                },
            });

            // Get Output

            return {
                reply: "",
                vertexOutput: "JSON" as const,
                prompt: "",
            };
            /*
            return {
                reply: chatOutput.reply,
                vertexOutput: chatOutput.vertexOutput,
                prompt: input.message,
            };
            */
        },
    );

    public async chat(input: WhatsappRawValue | ChatInput): Promise<Result<ChatOutput>> {
        let chatInput: ChatInput = {
            mobile_no: "",
            created_by: "BASE",
        };

        // Extract data according to source
        if (this.isWhatsappInput(input)) {
            const rawMsg = input.messages?.[0];
            const contact = input.contacts?.[0];
            const meta = input.metadata;
            const message = whatsappService.parse(rawMsg!, contact, meta);

            if (contact && contact.wa_id) {
                const mobile_no: string = contact.wa_id;

                let newUser: boolean = false;
                let userResult: Result<UserData> = await userService.getUserByMobileNo(mobile_no);

                if (userResult.isFailure()) {
                    userResult = await userService.createUser(contact.wa_id, contact.profile.name);
                    newUser = true;
                }

                if (userResult.isSuccess()) {
                    const user: UserData = userResult.getData();
                    const locationExist: boolean = !!user.coords;

                    const whatsappMessageFormatted = await whatsappService.handle(
                        message,
                        userResult.getData(),
                        newUser,
                        locationExist,
                    );
                    if (whatsappMessageFormatted != null) {
                        chatInput = whatsappMessageFormatted;
                    }
                }
            }
        } else if (this.isWebchatInput(input)) {
            chatInput = {
                mobile_no: "",
                created_by: "WEBCHAT",
            };
        } else {
            chatInput = input;
        }

        // Deconstruct variables for easier access
        const { mobile_no, created_by, message, media_url, media_name } = chatInput;
        const mediaName = media_name ?? "";

        // Save user message into chat history
        const saveChatHistoryResult = await chatRepository.saveChatHistory(mobile_no, created_by.toLowerCase(), {
            role: "user",
            timestamp: "",
            message: message,
            media_url: media_url,
            media_name: media_name ?? "",
        });
        if (!saveChatHistoryResult) {
            throw Error(`Failed to save chat history.`);
        }

        // Parse into Gemini 3.0 for image diagnosis first if media_url exists
        if (media_url && media_url != "") {
            const geminiImageResult: Result<ImageOutput> = await geminiService.image(media_url);
            if (geminiImageResult.isFailure()) {
                const deleteImageResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
                if (deleteImageResult.isFailure()) {
                    throw new Error("handleImage delete image failed.");
                }

                if (
                    geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE &&
                    geminiImageResult.getMessage() ===
                        "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."
                ) {
                    return Result.fail(
                        ENUM_STATUS_CODES_FAILURE.SERVICE_UNAVAILABLE,
                        "We are currently experiencing high demand, please try again later.",
                    );
                } else if (
                    geminiImageResult.getStatusCode() === ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS &&
                    geminiImageResult.getMessage() === "Resource has been exhausted (e.g. check quota)."
                ) {
                    return Result.fail(
                        ENUM_STATUS_CODES_FAILURE.TOO_MANY_REQUESTS,
                        "You are sending images too frequently, please send again in 1 minute.",
                    );
                }
                throw Error(
                    `handleImage error, gemini error code ${geminiImageResult.getStatusCode()}: ${geminiImageResult.getMessage()}`,
                );
            }

            const imageOutput: ImageOutput = geminiImageResult.getData();

            if (imageOutput.detections[0]?.disease === "NOT DETECTED") {
                const deleteImageResult: Result<null> = await mediaService.deleteMediaByMediaName(mediaName);
                if (deleteImageResult.isFailure()) {
                    throw new Error("handleImage delete image failed.");
                }
                return Result.succeed(
                    ENUM_STATUS_CODES_SUCCESS.OK,
                    "I couldn’t detect any rice paddies in this image. Please upload an image that clearly shows a rice field for analysis.",
                    "handleImage success.",
                );
            } else if (imageOutput.detections[0]?.disease === "HEALTHY") {
                const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
                    mediaName,
                    imageOutput.detections,
                );
                if (!image.isFailure()) {
                    throw new Error("handleImage failed to update image dianogsis");
                }

                return Result.succeed(
                    ENUM_STATUS_CODES_SUCCESS.OK,
                    "No visible signs of disease detected. The rice plants appear healthy based on this image.",
                    "handleImage success.",
                );
            } else {
                const image: Result<MediaData> = await mediaService.updateImageOrVideoDiagnosis(
                    mediaName,
                    imageOutput.detections,
                );
                if (!image.isFailure()) {
                    throw new Error("handleImage failed to update image dianogsis");
                }
            }

            // Send the bar chart
            // Sedn what it found
            if (!message || message == "") {
                // ask if you wldl ike more details?
            }
        }

        // Parse caption or message if any
        if (message) {
        }

        const output = await this.chatFlow(chatInput);
        if (!output?.reply) {
            return Result.fail(ENUM_STATUS_CODES_FAILURE.INTERNAL_SERVER_ERROR, "AI failed to generate a reply.");
        }

        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, output, "Chat response generated.");
    }

    // Shared function between webchat and whatsapp due to identical structure
    public async handleLocation(mobile_no: string, latitude: number, longitude: number): Promise<Result<UserData>> {
        const userResult: Result<UserData> = await userService.updateUserCoordsByMobileNo(
            latitude,
            longitude,
            mobile_no,
        );
        if (userResult.isFailure()) {
            return Result.fail(userResult.getStatusCode(), userResult.getMessage());
        }

        const user: Result<UserData> = await userService.getUserByMobileNo(mobile_no);
        if (user.isFailure()) {
            return Result.fail(user.getStatusCode(), user.getMessage());
        }

        return Result.succeed(ENUM_STATUS_CODES_SUCCESS.OK, user.getData(), "handleLocation success.");
    }

    // Validate if the input is from Whatsapp
    private isWhatsappInput(input: any): input is WhatsappRawValue {
        return input && typeof input === "object" && "messaging_product" in input;
    }

    // Validate if the input is from Sky's frontend webchat
    private isWebchatInput(input: any): input is WhatsappRawValue {
        return input && typeof input === "object" && "messaging_product" in input;
    }

    private sendText(mobile_no: string, type: string, message: string) {
        if (type === "WHATSAPP") {
            whatsappService.sendText(mobile_no, message);
        } else if (type === "WEBCHAT") {
        }
    }

    // Helper to read the filetype for media_url
    private getContentType(url: string): string {
        const extension = url.split(".").pop()?.toLowerCase();

        const map: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            ogg: "audio/ogg",
            mp4: "video/mp4",
            pdf: "application/pdf",
        };

        return extension && map[extension] ? map[extension] : "image/jpeg";
    }
}

export default new ChatService();
