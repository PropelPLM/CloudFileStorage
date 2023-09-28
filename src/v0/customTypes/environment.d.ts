declare global {
  namespace NodeJS {
    interface ProcessEnv {
      platform: string;
      clientId: string;
      clientSecret: string;
      salesforceUrl: string;
      tenantId: string;
      destinationFolderId: string;
      CLOUD_FILE_STORAGE_KEY: string | undefined;
      PLATFORM_CONFIG: string;
    }
  }
}

export {}
