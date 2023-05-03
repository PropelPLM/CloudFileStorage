declare module '@propelsoftwaresolutions/propel-sfdc-connect' {
  type PropelAuthRequest = {
    clientId: string;
    isTest: boolean;
    privateKey: string;
    user: string;
  };

  export function jwtSession(authRequest: PropelAuthRequest): Record<string, string>;
}
