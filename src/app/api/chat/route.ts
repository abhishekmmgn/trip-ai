import { convertToCoreMessages, Message, streamText, tool } from "ai";
import { z } from "zod";
import { geminiProModel } from "@/ai";
import { getCitiesInACountry, getPlaces, getPlacesInACountry } from "@/ai/actions";
import { activities } from "@/lib/constants";
import { saveChat } from "@/db/queries";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(request: Request) {
	const { id, messages }: { id: string; messages: Array<Message> } =
		await request.json();

	const coreMessages = convertToCoreMessages(messages).filter(
		(message) => message.content.length > 0,
	);

	const result = await streamText({
		model: geminiProModel,
		system: `\n
    You are a help assisant to help users plan their trips. You've to reply in whichever language they're prompting. Keep your responses limited to a sentence and do not output list.
    Here's the optimal flow
      - ask for the city or country they want to visit
      - ask for the duration of the trip and the dates
      - show places the user can visit in that city/cities user wants to visit.
      - suggest activities/interests to explore. Here are these ${activities}. Do not add activities on your own. Always use the provided activities.
      - display the summary of the places they've chosen
      - When city is final, ask their boarding city and show the flights.
      - Also ask if they want suggestions for the hotels in the destination city.
      - If the user is breaking the flow, let it break.

    - After every tool call, pretend you're showing the result to the user and keep your response limited to a phrase.
    - Today's date is ${new Date().toLocaleDateString()}.
    - Ask follow up questions to nudge user into the optimal flow
    - Make sure to match the relevant names when giving the arguments, like if the user typed 'parise' instead of paris or barcelona instead of Barcelona, send the correct name as the argument to the tools.
    - while passing argument if the name of the activity is more than a letter long format it like this: arts and culture -> arts-and-culture, but if the name is country, separate only by space united states -> united states. Also convert them to lowercase as well.
    - Intelligently guess if it is a city or a country or a place or activity and then use the right tool for the job.
    `,
		messages: coreMessages,
		tools: {
			getPlacesInACity: {
				description:
					"Get places to visit in a city. Optionally filter by activities.",
				parameters: z.object({
					cityName: z.string().describe("Name of the city"),
					cityId: z.string().describe("Id of the city").optional(),
					activityName: z
						.string()
						.describe("Activities user can do.")
						.optional(),
				}),
				execute: async ({ cityName, cityId, activityName }) => {
					const places = await getPlaces(cityName, cityId, activityName);
					return places;
				},
			},
			getCitiesInACountry: {
				description: "Get cities to visit in a country. Does not offer places.",
				parameters: z.object({
					countryName: z.string().describe("Name of the country. For country with names with more than 1 word, like US or UK, the name is United State or United Kingdom etc."),
				}),
				execute: async ({ countryName }) => {
					const data: Array<{
						name: string;
						id: string;
					}> | { error: string } = await getCitiesInACountry(countryName);

					if ('error' in data) {
						return "Can't find the cities. But you can find places to visit in the country.";
					}

					return data.map((city) => city.name);
				}
			},
			getPlacesInACountry: {
				description:
					"Get places to visit in a country. Optionally filter by activities.",
				parameters: z.object({
					countryName: z.string().describe("Name of the country. For country with names with more than 1 word, like US or UK, the name is United State or United Kingdom etc."),
					activityName: z
						.string()
						.describe("Activities user can do.")
						.optional(),
				}),
				execute: async ({ countryName, activityName }) => {
					const places = await getPlacesInACountry(
						countryName,
						activityName,
					);
					return places;
				},
				// getFlights:  {}
				// getHotels:  {}
			},
			getWeather: {
				description: "Get the current weather at a location",
				parameters: z.object({
					latitude: z.number().describe("Latitude coordinate"),
					longitude: z.number().describe("Longitude coordinate"),
				}),
				execute: async ({ latitude, longitude }) => {
					const response = await fetch(
						`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
					);

					const weatherData = await response.json();
					return weatherData;
				},
			},
		},
		onFinish: async () => {
			// console.log(responseMessages)
			try {
				await saveChat({
					id,
					messages: [...coreMessages],
					// messages: [...coreMessages, ...responseMessages],
				});
				console.log("chat saved");
			} catch (error) {
				console.log(error);
				console.error("Failed to save chat");
			}
		},
		experimental_telemetry: {
			isEnabled: true,
			functionId: "stream-text",
		},
	});

	return result.toDataStreamResponse();
}
