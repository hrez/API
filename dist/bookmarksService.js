"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require("uuid");
const baseService_1 = require("./baseService");
const bookmarksModel_1 = require("./bookmarksModel");
const config_1 = require("./config");
const exception_1 = require("./exception");
const server_1 = require("./server");
// Implementation of data service for bookmarks operations
class BookmarksService extends baseService_1.default {
    // Creates a new bookmarks sync with the supplied bookmarks data
    // Returns a new sync ID and last updated date
    createBookmarks(bookmarksData, req) {
        return __awaiter(this, void 0, void 0, function* () {
            // Before proceeding, check service is available
            server_1.default.checkServiceAvailability();
            // Check service is accepting new syncs
            const isAcceptingNewSyncs = yield this.isAcceptingNewSyncs();
            if (!isAcceptingNewSyncs) {
                throw new exception_1.NewSyncsForbiddenException();
            }
            // Check if daily new syncs limit has been hit if config value enabled
            if (config_1.default.get().dailyNewSyncsLimit > 0) {
                const newSyncsLimitHit = yield this.service.newSyncsLimitHit(req);
                if (newSyncsLimitHit) {
                    throw new exception_1.NewSyncsLimitExceededException();
                }
            }
            try {
                // Get a new sync id
                const id = this.newSyncId();
                // Create new bookmarks payload
                const newBookmarks = {
                    _id: id,
                    bookmarks: bookmarksData
                };
                const bookmarksModel = new bookmarksModel_1.default(newBookmarks);
                // Commit the bookmarks payload to the db
                const savedBookmarks = yield bookmarksModel.save();
                // Add to logs
                if (config_1.default.get().dailyNewSyncsLimit > 0) {
                    yield this.service.createLog(req);
                }
                this.log(server_1.LogLevel.Info, 'New bookmarks sync created', req);
                // Return the response data
                const returnObj = {
                    id,
                    lastUpdated: savedBookmarks.lastUpdated
                };
                return returnObj;
            }
            catch (err) {
                this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.createBookmarks', req, err);
                throw err;
            }
        });
    }
    // Retrieves an existing bookmarks sync using the supplied sync ID
    // Returns the corresponding bookmarks data and last updated date
    getBookmarks(id, req) {
        return __awaiter(this, void 0, void 0, function* () {
            // Before proceeding, check service is available
            server_1.default.checkServiceAvailability();
            try {
                // Query the db for the existing bookmarks data and update the last accessed date
                const updatedBookmarks = yield bookmarksModel_1.default.findOneAndUpdate({ _id: id }, { lastAccessed: new Date() }, { new: true }).exec();
                // Return the existing bookmarks data if found 
                const response = {};
                if (updatedBookmarks) {
                    response.bookmarks = updatedBookmarks.bookmarks;
                    response.lastUpdated = updatedBookmarks.lastUpdated;
                }
                return response;
            }
            catch (err) {
                this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.getBookmarks', req, err);
                throw err;
            }
        });
    }
    // Returns the last updated date for the supplied sync ID
    getLastUpdated(id, req) {
        return __awaiter(this, void 0, void 0, function* () {
            // Before proceeding, check service is available
            server_1.default.checkServiceAvailability();
            try {
                // Query the db for the existing bookmarks data and update the last accessed date
                const updatedBookmarks = yield bookmarksModel_1.default.findOneAndUpdate({ _id: id }, { lastAccessed: new Date() }, { new: true });
                // Return the last updated date if bookmarks data found 
                const response = {};
                if (updatedBookmarks) {
                    response.lastUpdated = updatedBookmarks.lastUpdated;
                }
                return response;
            }
            catch (err) {
                this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.getLastUpdated', req, err);
                throw err;
            }
        });
    }
    // Returns true/false depending whether the service is currently accepting new syncs
    isAcceptingNewSyncs() {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if allowNewSyncs config value enabled
            if (!config_1.default.get().status.allowNewSyncs) {
                return false;
            }
            // Check if maxSyncs config value disabled
            if (config_1.default.get().maxSyncs === 0) {
                return true;
            }
            // Check if total syncs have reached limit set in config  
            const bookmarksCount = yield this.getBookmarksCount();
            return bookmarksCount < config_1.default.get().maxSyncs;
        });
    }
    // Updates an existing bookmarks sync corresponding to the supplied sync ID with the supplied bookmarks data
    // Returns the last updated date
    updateBookmarks(id, bookmarksData, req) {
        return __awaiter(this, void 0, void 0, function* () {
            // Before proceeding, check service is available
            server_1.default.checkServiceAvailability();
            try {
                // Update the bookmarks data corresponding to the sync id in the db
                const now = new Date();
                const updatedBookmarks = yield bookmarksModel_1.default.findOneAndUpdate({ _id: id }, {
                    bookmarks: bookmarksData,
                    lastAccessed: now,
                    lastUpdated: now
                }, { new: true }).exec();
                // Return the last updated date if bookmarks data found and updated
                const response = {};
                if (updatedBookmarks) {
                    response.lastUpdated = updatedBookmarks.lastUpdated;
                }
                return response;
            }
            catch (err) {
                this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.createBookmarks', req, err);
                throw err;
            }
        });
    }
    // Returns the total number of existing bookmarks syncs
    getBookmarksCount() {
        return __awaiter(this, void 0, void 0, function* () {
            let bookmarksCount = -1;
            try {
                bookmarksCount = yield bookmarksModel_1.default.count({}).exec();
            }
            catch (err) {
                this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.getBookmarksCount', null, err);
                throw err;
            }
            // Ensure a valid count was returned
            if (bookmarksCount < 0) {
                const err = new exception_1.UnspecifiedException('Bookmarks count cannot be less than zero');
                this.log(server_1.LogLevel.Error, 'Exception occurred in NewSyncLogsService.newSyncsLimitHit', null, err);
                throw err;
            }
            return bookmarksCount;
        });
    }
    // Generates a new 32 char id string
    newSyncId() {
        let newId;
        try {
            // Create a new v4 uuid and return as an unbroken string to use for a unique id
            const bytes = uuid.v4(null, new Buffer(16));
            newId = new Buffer(bytes, 'base64').toString('hex');
        }
        catch (err) {
            this.log(server_1.LogLevel.Error, 'Exception occurred in BookmarksService.newSyncId', null, err);
            throw err;
        }
        return newId;
    }
}
exports.default = BookmarksService;
//# sourceMappingURL=bookmarksService.js.map