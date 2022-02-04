const stream = jest.genMockFromModule('stream');
import { ptObject } from './helperObjects/PassThrough';
const PassThrough = jest.fn(() => {return ptObject});
stream.PassThrough = PassThrough;

module.exports = stream;
