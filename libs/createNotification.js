import Notification from '@/models/Notification'
import { connectToDB } from './functions'

export async function createNotification({
    userId,
    title,
    description,
    type,
    data
}) {
    try {
        await connectToDB()
        
        const notification = new Notification({
            userId,
            title,
            description,
            type,
            data,
            read: false
        })

        await notification.save()
        return notification
    } catch (error) {
        console.error('Error creating notification:', error)
        throw error
    }
}

export async function createBidNotification({
    userId,
    auctionId,
    bidAmount,
    bidderName,
    bidderEmail,
    type,
    title,
    description
}) {
    return createNotification({
        userId,
        title,
        description,
        type,
        data: { auctionId, bidAmount, bidderName, bidderEmail }
    });
}