export const NOTIFICATION_COUNTS_QUERY = `
  query NotificationCounts {
    notificationCounts {
      ... on NotificationCounts {
        conversations {
          unread
        }
        jobApplications {
          unread
        }
        bookings {
          unread
        }
      }
    }
  }
`;
