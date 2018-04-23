import { request, RequestOptions } from "http";
import { stringify } from "querystring";
import { Config } from "./Config";

export interface ITextMessageConfig {
    host: string;
    url: string;
    username: string;
    password: string;
    number: string;
}

export interface ITextMessageResult {
    RetStatus: number;
}

export class TextMessage {

    public static getInstance(): TextMessage {
        if (!TextMessage.instance) {
            TextMessage.instance = new TextMessage(Config.get<ITextMessageConfig>("sms"));
        }
        return TextMessage.instance;
    }

    private static instance: TextMessage;

    constructor(private config: ITextMessageConfig) {
    }

    public async sendMessage(text: string, to: string): Promise<ITextMessageResult> {
        const { username, password, number } = this.config;
        return new Promise<ITextMessageResult>((resolve, reject) => {
            const req = request(this.getReqOptions(), (res) => {
                const chunks = [];
                res.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                res.on("end", () => {
                    const body = Buffer.concat(chunks);
                    resolve(JSON.parse(body.toString()));
                });
            });
            req.on("error", (error) => {
                reject(error);
            });
            req.write(stringify({ username, password, to, from: number, text, isflash: "false" }));
            req.end();
        });
    }
    private getReqOptions(): RequestOptions {
        const { host, url } = this.config;
        return {
            headers: {
                "cache-control": "no-cache",
                "content-type": "application/x-www-form-urlencoded",
                "postman-token": "986f8677-6806-fd9c-62bf-5b7594a44066",
            },
            hostname: host,
            method: "POST",
            path: url,
            port: null,
        };
    }
}