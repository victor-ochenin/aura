import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export const useConversation = (id: Id<"conversations"> | null) => {
    return useQuery(api.conversations.getById, id ? {id} : "skip");
};

export const useMessages = (id: Id<"conversations"> | null) => {
    return useQuery(api.conversations.getMessages, id ? {conversationId: id} : "skip");
}

export const useConversations = (projectId: Id<"projects">) => {
    return useQuery(api.conversations.getByProject, {projectId});
}

export const useCreateConversation = () => {
    return useMutation(api.conversations.create);
}