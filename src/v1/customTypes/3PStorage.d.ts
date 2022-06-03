type Platform = 'googledrive' | 'aws' | 'office365';

class CreatedFileDetails {
    constructor(
        public status: number,
        public id: string,
        public name: string,
        public webViewLink: string,
        public fileExtension: string,
        public platform: Platform,
    ) {}
    public webContentLink?: string
    public fileSize?: number
}

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
    api(endpoint: string)
}

type CloudStorageProviderClient = MicrosoftClient | OAuth2Client | S3
