import { Request, Response } from "express";

export const responseGenerator = (_: Request, res: Response) => {
    // const requestBody = JSON.stringify(req.body);
    if (res.locals.err) {
        res.json({ status: res.locals.err.code, error: res.locals.err.error })
    } else {
        res.json(res.locals.result);
    }
}
