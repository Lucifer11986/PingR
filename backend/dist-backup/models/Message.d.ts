import { Document, Types } from 'mongoose';
export interface IReaction {
    emoji: string;
    userId: Types.ObjectId;
    username: string;
}
export interface IMessage extends Document {
    conversationId: Types.ObjectId;
    sender: Types.ObjectId;
    content: string;
    type: 'text' | 'image' | 'file';
    fileUrl?: string;
    fileName?: string;
    readBy: Types.ObjectId[];
    reactions: IReaction[];
    createdAt: Date;
}
export declare const Message: import("mongoose").Model<IMessage, {}, {}, {}, Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Message.d.ts.map