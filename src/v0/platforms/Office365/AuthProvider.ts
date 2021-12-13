import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import qs from 'qs';
import axios, { AxiosRequestConfig } from 'axios';

class AuthProvider implements AuthenticationProvider {

  private readonly scope: string = 'https://graph.microsoft.com/.default offline_access';
  private readonly grantType: string = 'client_credentials';
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;

  constructor(clientId: string, clientSecret: string, tenantId: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenantId = tenantId;
  }

  private generateTokenEndpoint(tenantId: string): string {
    if (tenantId == null) throw new Error('TenantId not passed into authenticator.')
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  }

  public async getAccessToken(): Promise<string> {
    const postData: Record<string, string> = {
      client_id: this.clientId,
      scope: this.scope,
      client_secret: this.clientSecret,
      grant_type: this.grantType
    };
    const options: AxiosRequestConfig = {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      data: qs.stringify(postData),
      url: this.generateTokenEndpoint(this.tenantId)
    };
    const tokenRequestResponse = await axios(options);
    return tokenRequestResponse.data.access_token;
  }
}

export default AuthProvider;
