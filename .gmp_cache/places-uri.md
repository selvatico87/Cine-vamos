# Return the URI to open the place details page in Google Maps for a place

This capability allows you to retrieve Google Maps deep links for a
place—Specifically the URI to open the place details page directly in Google
Maps—using the Places API (New) via Text Search (New), Nearby Search (New), or
Place Details (New).

## Prerequisites

This capability extends the following core Places API methods:

*   **Text Search (New)**: Return information about places based on a query
    string (`POST https://places.googleapis.com/v1/places:searchText`).
*   **Nearby Search (New)**: Return information about places near a specific
    location (`POST https://places.googleapis.com/v1/places:searchNearby`).
*   **Place Details (New)**: Return detailed information about a specific place
    (`GET https://places.googleapis.com/v1/places/{place_id}`).

## Field Mask Configuration

To receive the URI that opens the place details page in Google Maps, you must
include the `googleMapsLinks` object (or the specific `placeUri` field) in the
`X-Goog-FieldMask` HTTP header of your request.

Method                  | Field Mask for All Maps Links | Field Mask for Place Details URI Only
:---------------------- | :---------------------------- | :------------------------------------
**Text Search (New)**   | `places.googleMapsLinks`      | `places.googleMapsLinks.placeUri`
**Nearby Search (New)** | `places.googleMapsLinks`      | `places.googleMapsLinks.placeUri`
**Place Details (New)** | `googleMapsLinks`             | `googleMapsLinks.placeUri`

> **Note:** Previously, the `Place` object included the `googleMapsUri` field
> (`places.googleMapsUri` or `googleMapsUri`). The `googleMapsLinks.placeUri`
> field returns the exact same URI value as `googleMapsUri`, while also
> organizing it alongside other supported Google Maps links (`directionsUri`,
> `writeAReviewUri`, `reviewsUri`, and `photosUri`).

## Implementation Examples

### 1. Requesting All Google Maps Links (including `placeUri`) via Text Search (New)

Include `places.googleMapsLinks` in the `X-Goog-FieldMask` header to return
`placeUri` along with directions, review, and photo links.

```bash
curl -X POST -d '{
  "textQuery" : "San Francisco International Airport"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: places.displayName,places.formattedAddress,places.googleMapsLinks' \
'https://places.googleapis.com/v1/places:searchText'
```

#### Response

```json
{
  "places": [
    {
      "formattedAddress": "San Francisco, CA 94128, USA",
      "displayName": {
        "text": "San Francisco International Airport",
        "languageCode": "en"
      },
      "googleMapsLinks": {
        "placeUri": "https://maps.google.com/?cid=11885663895765773631",
        "directionsUri": "https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x808f778c55555555:0xa4f25c571acded3f!3e0",
        "writeAReviewUri": "https://www.google.com/maps/place//data=!4m3!3m2!1s0x808f778c55555555:0xa4f25c571acded3f!12e1",
        "reviewsUri": "https://www.google.com/maps/place//data=!4m4!3m3!1s0x808f778c55555555:0xa4f25c571acded3f!9m1!1b1",
        "photosUri": "https://www.google.com/maps/place//data=!4m3!3m2!1s0x808f778c55555555:0xa4f25c571acded3f!10e5"
      }
    }
  ]
}
```

### 2. Requesting Only the Place Details URI

If you only need the link to open the place in Google Maps without the
additional links, specify `places.googleMapsLinks.placeUri` (or
`googleMapsLinks.placeUri` for Place Details) in your field mask:

```bash
curl -X POST -d '{
  "textQuery" : "San Francisco International Airport"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: places.displayName,places.googleMapsLinks.placeUri' \
'https://places.googleapis.com/v1/places:searchText'
```

### 3. Requesting Place URI via Place Details (New)

When querying a specific place by its `place_id`, omit the `places.` prefix in
the `X-Goog-FieldMask` header:

```bash
curl -X GET \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: displayName,googleMapsLinks.placeUri' \
'https://places.googleapis.com/v1/places/ChIJVVVVVYx3j4ARP-3NGldc8qQ'
```

## Reference: Supported `googleMapsLinks` Fields

When requesting `googleMapsLinks`, the following URI fields are available:

Field Name                        | Description
:-------------------------------- | :----------
`googleMapsLinks.placeUri`        | **Link to open Google Maps to the place details page.** (Matches `googleMapsUri`)
`googleMapsLinks.directionsUri`   | Link to open directions to the place in Google Maps (uses current location as origin and drive mode).
`googleMapsLinks.writeAReviewUri` | Link to write a review for the place in Google Maps.
`googleMapsLinks.reviewsUri`      | Link to view Google Maps reviews of the place.
`googleMapsLinks.photosUri`       | Link to view photos of the place in Google Maps.
