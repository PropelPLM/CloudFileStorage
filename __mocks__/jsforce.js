const jsConnect = jest.genMockFromModule('jsforce');
import { JsConnection } from './helperObjects/JsConnection';
const Connection = jest.fn(() => JsConnection);
jsConnect.Connection = Connection;

export default jsConnect;
