export const JsConnection = {
  sobject: jest.fn(() => {
    return {
      upsert: jest.fn(),
      create: jest.fn()
    }
  }),
  query: jest.fn().mockResolvedValue({
    records:
      [
        { NamespacePrefix: 'NAMESPACE' }
      ]
  }),
}
