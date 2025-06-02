import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

class AuthProvider implements AuthenticationProvider {

  private readonly scope: string = 'https://graph.microsoft.com/.default offline_access';
  private clientCredential: any;

  constructor(clientId: string, clientSecret: string, tenantId: string) {
    this.clientCredential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  }

  public async getAccessToken(): Promise<string> {
    try {
      const token = await this.clientCredential.getToken(this.scope);
      return token ? token.token : '';
    } catch (err: any) {
      console.log(`Failed to get AccessToken: ${err.message!}`)
      throw err
    }
  }
}

export default AuthProvider;
