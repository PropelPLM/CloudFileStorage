const xlsxPopulate = jest.genMockFromModule('xlsx-populate');
xlsxPopulate.fromBlankAsync = jest.fn(async ()=> {
  return {
    outputAsync: jest.fn()
  }
});

module.exports = xlsxPopulate;
