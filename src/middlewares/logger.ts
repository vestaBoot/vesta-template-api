import { LogLevel } from "@vesta/services";
import { NextFunction, Response } from "express";
import { IExtRequest } from "../api/BaseController";
import { IUser } from "../cmn/models/User";
import { LogFactory } from "../helpers/LogFactory";

export function loggerMiddleware(req: IExtRequest, res: Response, next: NextFunction) {
    const sourceApp = +(req.body.s || req.query.s);
    const user = req.session.get<IUser>("user");
    const log = LogFactory.create(user && user.id ? +user.id : 0);
    res.on("end", onAfterResponse);
    res.on("finish", onAfterResponse);
    req.log = log.log;
    next();

    function onAfterResponse() {
        const message = [
            req.headers["X-Real-IP"] || req.ip,
            `${req.method} ${req.url} ${res.statusCode}`,
            req.headers["user-agent"],
        ];
        if (sourceApp !== SourceApp.Panel) {
            // saving request information
            log.log(LogLevel.Info, message.join("-;-"), "loggerMiddleware");
        }
        log.save();
    }
}
