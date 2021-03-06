import { Request, Response } from "express";

export class ResponseError {
    constructor(public status: number, public error: string){}
}

export const responseGenerator = (_: Request, res: Response) => {
    // const requestBody = JSON.stringify(req.body);
    if (res.locals.err) {
        const status = res.locals.err.status;
        res.status(status).json({ status, error: res.locals.err.error } as ResponseError);
    } else {
        res.json({ data: res.locals.result });
    }
}
