import { Document, Types } from 'mongoose';
export interface IContact extends Document {
    owner: Types.ObjectId;
    user: Types.ObjectId;
    nickname?: string;
    addedAt: Date;
}
export declare const Contact: import("mongoose").Model<IContact, {}, {}, {}, Document<unknown, {}, IContact, {}, {}> & IContact & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Contact.d.ts.map