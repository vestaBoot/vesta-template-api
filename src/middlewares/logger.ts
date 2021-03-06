import { LogLevel } from "@vesta/services";
import { NextFunction, Response } from "express";
import { IExtRequest } from "../api/BaseController";
import { SourceApp } from "../cmn/enum/SourceApp";
import { LogFactory } from "../helpers/LogFactory";

export function loggerMiddleware(req: IExtRequest, res: Response, next: NextFunction) {
    const sourceApp = +req.get("From");
    const { user } = req.auth;
    const log = LogFactory.create(user && user.id ? +user.id : 0);
    res.on("end", onAfterResponse);
    res.on("finish", onAfterResponse);
    req.log = log.log;
    next();

    function onAfterResponse() {
        const message = [req.headers["X-Real-IP"] || req.ip, `${req.method} ${req.url} ${res.statusCode}`, req.headers["user-agent"]];
        if (sourceApp !== SourceApp.Panel) {
            // saving request information
            log.log(LogLevel.Info, message.join("-;-"), "loggerMiddleware");
        }
        log.save();
    }
}
