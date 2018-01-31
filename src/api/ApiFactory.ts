import { Router } from "express";
import { Acl } from "../helpers/Acl";
import { IServerAppConfig } from "../helpers/Config";
import { Database } from "../medium";
import { exporter } from "./v1/import";

export class ApiFactory {

    public static create(config: IServerAppConfig, acl: Acl, database: Database): Promise<any> {
        let apiRouter = Router();
        return ApiFactory.loadControllers(config, acl, database)
            .then(controllerRouter => apiRouter.use(`/api/${config.version.api}`, controllerRouter))
    }

    private static loadControllers(config: IServerAppConfig, acl, database: Database): Promise<Router> {
        return new Promise((resolve, reject) => {
            let router: Router = Router(),
                resolveList: Array<Promise<boolean>> = [];
            for (let controllerName in exporter.controller) {
                if (exporter.controller.hasOwnProperty(controllerName)) {
                    let instance = new exporter.controller[controllerName](config, acl, database);
                    instance.route(router);
                    let resolver = instance.resolve();
                    if (resolver) resolveList.push(resolver);
                }
            }
            return resolveList.length ?
                Promise.all(resolveList).then(() => resolve(router)).catch(reason => reject(reason)) :
                resolve(router);
        });
    }
}