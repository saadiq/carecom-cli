// GetCaregiver - full profile with all service verticals
export const GET_CAREGIVER_QUERY = `
  query GetCaregiver(
    $id: ID!
    $serviceId: ServiceType!
    $shouldIncludeAllProfiles: Boolean!
  ) {
    getCaregiver(
      id: $id
      serviceId: $serviceId
      shouldIncludeAllProfiles: $shouldIncludeAllProfiles
    ) {
      ... on Caregiver {
        yearsOfExperience
        signUpDate
        responseTime
        responseRate
        badges
        hasCareCheck
        hiredTimes
        isFavorite
        member {
          id
          legacyId
          displayName
          firstName
          lastName
          imageURL
          isPremium
          address {
            city
            state
            zip
          }
        }
        profiles {
          serviceIds
          commonCaregiverProfile {
            id
            bio {
              experienceSummary
            }
          }
          childCareCaregiverProfile {
            id
            bio {
              experienceSummary
            }
            payRange {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
            recurringRate {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
            yearsOfExperience
            ageGroups
            numberOfChildren
          }
          tutoringCaregiverProfile {
            id
            bio {
              experienceSummary
            }
            payRange {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
            specificSubjects
            yearsOfExperience
          }
          houseKeepingCaregiverProfile {
            id
            bio {
              experienceSummary
            }
            payRange {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
            recurringRate {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
          }
          petCareCaregiverProfile {
            id
            bio {
              experienceSummary
            }
            payRange {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
          }
          seniorCareCaregiverProfile {
            id
            bio {
              experienceSummary
            }
            payRange {
              hourlyRateFrom { amount }
              hourlyRateTo { amount }
            }
          }
        }
        revieweeMetrics {
          ... on RevieweeMetricsPayload {
            metrics {
              totalReviews
              averageRatings {
                type
                value
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_AVAILABILITY_QUERY = `
  query GetCalendar($providerId: String!) {
    AvailabilityCalendar(providerId: $providerId) {
      availability {
        endTime
        startTime
        freeBusyType
      }
      lastUpdated
    }
  }
`;
