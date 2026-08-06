import { Document, Types } from 'mongoose';
export interface IConversation extends Document {
    participants: Types.ObjectId[];
    isGroup: boolean;
    groupName?: string;
    groupAvatar?: string;
    lastMessage?: Types.ObjectId;
    unreadCounts: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Conversation: import("mongoose").Model<IConversation, {}, {}, {}, Document<unknown, {}, IConversation, {}, {}> & IConversation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Conversation.d.ts.map