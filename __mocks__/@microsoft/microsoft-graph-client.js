import { unwrapped } from '../helperObjects/OAuth';

export const authClient = unwrapped;
export const Client = {
  initWithMiddleware: jest.fn().mockReturnValue({})
}

export const ResponseType = { RAW: '' }
