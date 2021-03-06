export default undefined;
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeType: (received: string) => object;
    }
  }
}

expect.extend({
  toBeType(received: any, argument: any) {
    const initialType = typeof received;
    const type = initialType === "object" ? Array.isArray(received) ? "array" : initialType : initialType;
    return type === argument ? {
      message: () => `expected ${received} to be type ${argument}`,
      pass: true
    } : {
      message: () => `expected ${received} to be type ${argument}`,
      pass: false
    };
  }
})