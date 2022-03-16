interface GoogleFile {
    data: {
        id: string
        name: string
        webViewLink: string
        mimeType: string
        fileExtension: string
        webContentLink: string
    }
    status: string
}

interface OAuth2Client {
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
