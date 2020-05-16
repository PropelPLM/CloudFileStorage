interface IPlatform {
    readonly [index: string]: any;
    // Auth flow
    createAuthUrl? (credentials: Record<string, string>, instanceKey: string): string,
    getTokens? (code: string, instanceKey: string): void;

    // Upload flow
    authorize(instanceKey: string, clientId: string, clientSecret: string, tokens: Record<string, string>): void;
    initUpload(instanceKey: string, { fileName, mimeType, fileSize }: { fileName: string, mimeType: string, fileSize: number }): void;
    uploadFile(instanceKey: string, payload: Record<string, any>): void;
    endUpload(instanceKey: string): void;
}
