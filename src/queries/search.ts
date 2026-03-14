export const SEARCH_PROVIDERS_QUERY = `
  query SearchProvidersChildCare($input: SearchProvidersChildCareInput!) {
    searchProvidersChildCare(input: $input) {
      ... on SearchProvidersSuccess {
        searchProvidersConnection {
          totalHits
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              ... on Caregiver {
                member {
                  id
                  legacyId
                  displayName
                  imageURL
                  address {
                    city
                    state
                    zip
                  }
                }
                yearsOfExperience
                responseTime
                hasCareCheck
                badges
                hiredTimes
                profiles {
                  commonCaregiverProfile {
                    id
                    bio {
                      experienceSummary
                    }
                  }
                  childCareCaregiverProfile {
                    recurringRate {
                      hourlyRateFrom {
                        amount
                      }
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
        }
      }
    }
  }
`;
