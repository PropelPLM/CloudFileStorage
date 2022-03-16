export const ptObject: { percent: number, push: any } = {
  percent: 0,
  push: jest.fn().mockImplementation(function(this: any) {
    this.percent = this.percent + 1;
    return this.percent;
  })
}
