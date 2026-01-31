
import { Button, ButtonProps, Callout } from "@blueprintjs/core";


type Args = {
	buttonText?: string,
	error: Error,
	resetErrorBoundary?: ButtonProps["onClick"]
};

function ErrorCallout({ buttonText = "Go back", error, resetErrorBoundary = undefined }: Args): JSX.Element {
	// Check if this is an AxiosError and provide a more user-friendly message
	const isAxiosError = error.name === "AxiosError" || (error as any).isAxiosError;
	let title = error.name;
	let message = error.message;

	if (isAxiosError) {
		const status = (error as any).response?.status;
		if (status === 404) {
			title = "Not Found";
			message = "This item could not be found in the external database. It may not have been indexed yet or the identifier may be incorrect.";
		} else if (status === 403) {
			title = "Access Denied";
			message = "Unable to access this resource. You may need to check your API credentials.";
		} else if (status >= 500) {
			title = "Server Error";
			message = "The external service is experiencing issues. Please try again later.";
		} else if (!navigator.onLine) {
			title = "No Internet Connection";
			message = "Please check your internet connection and try again.";
		}
	}

	return (
		<Callout intent="danger" title={title} >
			<p>{message}</p>
			{resetErrorBoundary !== undefined && <Button intent="danger" onClick={resetErrorBoundary} outlined={true} text={buttonText} />}
		</Callout>
	);
}

export { ErrorCallout };
