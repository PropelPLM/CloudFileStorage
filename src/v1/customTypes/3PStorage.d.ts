type MicrosoftClient = Client & {
    getToken?(code: string): Record<string, any>
    setCredentials?(tokens: Record<string, any>): void
    generateAuthUrl?(): string
}

type OAuth2Client = {
    generateAuthUrl({
        access_type: string,
        prompt: string,
        scope: string,
        state: string,
        [index in string]: string
    }): string

    getToken(code: string): Record<string, any>
    setCredentials(tokens: Record<string, any>): void
    api?(endpoint: string)
}

type CloudStorageProviderClient = MicrosoftClient | OAuth2Client | S3;
enum FolderNameEnum { 'Drafts', 'In Review', 'Released' };
