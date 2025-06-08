import { connectToDB, userInfo } from '@/libs/functions'
import Notification from '@/models/Notification'
import { NextResponse } from 'next/server'

// GET: Fetch all notifications for the current user
export async function GET(req) {
    try {
        await connectToDB()
        const user = await userInfo(req)
        console.log('hello', user);
        if (!user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const notifications = await Notification.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(50)
        console.log("Fetched notifications for user", user._id, ":", notifications);
        const unreadCount = await Notification.countDocuments({
            userId: user._id,
            read: false
        })
        console.log("nnn;", unreadCount);
        return NextResponse.json({
            notifications,
            unreadCount
        })
        
    } catch (error) {
        console.error('Error fetching notifications:', error)
        return NextResponse.json(
            { message: 'Failed to fetch notifications' },
            { status: 500 }
        )
    }
}

// POST: Mark notifications as read
export async function PUT(req) {
    try {
        await connectToDB()
        const user = await userInfo(req)
        console.log('hello2', user)
        if (!user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { ids } = await req.json()
        console.log("ids", ids);
        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json(
                { message: 'Invalid request body' },
                { status: 400 }
            )
        }

        const result = await Notification.updateMany(
            {
                _id: { $in: ids },
                userId: user._id
            },
            { $set: { read: true } }
        )
        console.log("result", result);

        return NextResponse.json({ message: 'Notifications marked as read' })
    } catch (error) {
        console.error('Error marking notifications as read:', error)
        return NextResponse.json(
            { message: 'Failed to mark notifications as read' },
            { status: 500 }
        )
    }
}

// DELETE: Delete notifications
export async function DELETE(req) {
    try {
        await connectToDB()
        const user = await userInfo(req)
        
        if (!user) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { ids } = await req.json()

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json(
                { message: 'Invalid request body' },
                { status: 400 }
            )
        }

        await Notification.deleteMany({
            _id: { $in: ids },
            userId: user._id
        })

        return NextResponse.json({ message: 'Notifications deleted successfully' })
    } catch (error) {
        console.error('Error deleting notifications:', error)
        return NextResponse.json(
            { message: 'Failed to delete notifications' },
            { status: 500 }
        )
    }
} 