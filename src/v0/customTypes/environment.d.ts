declare global {
  namespace NodeJS {
    interface ProcessEnv {
      platform: string;
      clientId: string;
      clientSecret: string;
      salesforceUrl: string;
      tenantId: string;
      destinationFolderId: string;
      PLATFORM_CONFIG: string;
    }
  }
}

export {}
