export function highlight(obj: any) {
	return syntaxHighlight(JSON.stringify(obj, undefined, 4));
}

// from: https://stackoverflow.com/a/7220510
//
// insert into string, html elements to highlight keys and properties of type:
// string, number, boolean and null by inserting their respective classes.
function syntaxHighlight(json_string: string) {
	json_string = json_string
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	return json_string.replace(
		/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
		function (match: any) {
			var cls = "number";
			if (/^"/.test(match)) {
				if (/:$/.test(match)) {
					cls = "key";
				} else {
					cls = "string";
				}
			} else if (/true|false/.test(match)) {
				cls = "boolean";
			} else if (/null/.test(match)) {
				cls = "null";
			}
			return '<span class="' + cls + '">' + match + "</span>";
		},
	);
}
