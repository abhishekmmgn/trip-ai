import Link from "next/link";

export default function Page() {
	return (
		<div className="h-[calc(100dvh-56px)] w-full grid items-start pt-36">
			<div className="text-center grid gap-y-3">
				<div className="text-center grid gap-y-3">
					<h1 className="home-h3 text-medium">404</h1>
					<p className="text-secondary-foreground text-lg">
						Could not find the conversation
					</p>
				</div>
				<Link
					href="/chat"
					className="w-fit mx-auto mt-2 text-primary text-lg underline-link"
				>
					Create new chat
				</Link>
			</div>
		</div>
	);
}
