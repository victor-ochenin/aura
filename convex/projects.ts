import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyAuth } from "./auth";

export const create = mutation({
    args: {
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx);
        
        const projectId = await ctx.db.insert("projects", {
            name: args.name,
            ownerId: identity.subject,
            updatedAt: Date.now(),
        });
        return projectId;
    },
});

export const getPartial = query({
    args: {
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx);

        return await ctx.db
        .query("projects")
        .withIndex("byOwner", (q) => q.eq("ownerId", identity.subject))
        .order("desc")
        .take(args.limit);
    }
});

export const get = query({
    args: {},
    handler: async (ctx) => {
        const identity = await verifyAuth(ctx);

        return await ctx.db
        .query("projects")
        .withIndex("byOwner", (q) => q.eq("ownerId", identity.subject))
        .order("desc")
        .collect();
    }
});

export const getById = query({
    args: {
        id: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx);

        const projects = await ctx.db.get("projects", args.id);

        if (!projects) {
            throw Error("Project not found");
        }

        if (projects.ownerId !== identity.subject) {
            throw Error("Unauthtorized access to this project")
        }

        return projects;
    }
});

export const rename = mutation({
    args: {
        id: v.id("projects"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx);

        const projects = await ctx.db.get("projects", args.id);

        if (!projects) {
            throw Error("Project not found");
        }

        if (projects.ownerId !== identity.subject) {
            throw Error("Unauthtorized access to this project")
        }

        await ctx.db.patch("projects", args.id, {
            name: args.name,
            updatedAt: Date.now(),
        })
    }
});