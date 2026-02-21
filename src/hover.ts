import * as vscode from 'vscode';

const TAG_DOCS: Record<string, { description: string; attributes: string; example: string }> = {
    'c:out': {
        description: 'Evaluates an expression and outputs the result to the current JspWriter.',
        attributes: '**value** (required) - Expression to evaluate\n\n**default** - Default if value is null\n\n**escapeXml** - Escape XML (default: true)',
        example: '```jsp\n<c:out value="${user.name}" default="Anonymous"/>\n```'
    },
    'c:set': {
        description: 'Sets a scoped variable or property of a target object.',
        attributes: '**var** - Variable name\n\n**value** - Value to set\n\n**scope** - page|request|session|application\n\n**target** - Object whose property to set\n\n**property** - Property name',
        example: '```jsp\n<c:set var="count" value="${count + 1}" scope="request"/>\n```'
    },
    'c:if': {
        description: 'Evaluates its body content if the test condition is true.',
        attributes: '**test** (required) - Boolean condition\n\n**var** - Store result variable\n\n**scope** - Variable scope',
        example: '```jsp\n<c:if test="${not empty user}">\n    Welcome, ${user.name}!\n</c:if>\n```'
    },
    'c:choose': {
        description: 'Provides mutual exclusivity (like switch/case). Contains <c:when> and optional <c:otherwise>.',
        attributes: 'No attributes.',
        example: '```jsp\n<c:choose>\n    <c:when test="${role eq \'admin\'}">Admin</c:when>\n    <c:otherwise>User</c:otherwise>\n</c:choose>\n```'
    },
    'c:forEach': {
        description: 'Iterates over a collection, or repeats body for a range of values.',
        attributes: '**var** - Current item\n\n**items** - Collection\n\n**varStatus** - Loop status (index, count, first, last, current)\n\n**begin/end/step** - Range iteration',
        example: '```jsp\n<c:forEach var="item" items="${list}" varStatus="s">\n    ${s.count}. ${item.name}\n</c:forEach>\n```'
    },
    'c:catch': {
        description: 'Catches any Throwable thrown from its body and optionally stores it.',
        attributes: '**var** - Variable to store exception',
        example: '```jsp\n<c:catch var="ex">\n    ${riskyOp}\n</c:catch>\n<c:if test="${not empty ex}">Error: ${ex.message}</c:if>\n```'
    },
    'c:url': {
        description: 'Builds a URL with proper encoding and session tracking.',
        attributes: '**value** (required) - URL path\n\n**var** - Store in variable\n\n**scope** - Variable scope',
        example: '```jsp\n<c:url value="/search" var="searchUrl">\n    <c:param name="q" value="${query}"/>\n</c:url>\n<a href="${searchUrl}">Search</a>\n```'
    },
    'c:redirect': {
        description: 'Sends HTTP redirect to the specified URL.',
        attributes: '**url** (required) - Redirect target',
        example: '```jsp\n<c:redirect url="/login"/>\n```'
    },
    'c:import': {
        description: 'Imports content from a URL (local or remote) into the page.',
        attributes: '**url** (required) - Source URL\n\n**var** - Store content in variable\n\n**charEncoding** - Character encoding',
        example: '```jsp\n<c:import url="/WEB-INF/fragments/nav.jsp"/>\n```'
    },
    'fmt:formatNumber': {
        description: 'Formats a numeric value as a number, currency, or percentage.',
        attributes: '**value** (required) - Number\n\n**type** - number|currency|percent\n\n**pattern** - Custom pattern (#,###.##)\n\n**currencyCode** - e.g. KRW, USD',
        example: '```jsp\n<fmt:formatNumber value="${price}" type="currency" currencyCode="KRW"/>\n```'
    },
    'fmt:formatDate': {
        description: 'Formats a date/time value using the specified pattern or style.',
        attributes: '**value** (required) - Date object\n\n**type** - date|time|both\n\n**pattern** - Custom pattern (yyyy-MM-dd)\n\n**dateStyle/timeStyle** - short|medium|long|full',
        example: '```jsp\n<fmt:formatDate value="${now}" pattern="yyyy년 MM월 dd일 HH:mm"/>\n```'
    },
    'fmt:message': {
        description: 'Retrieves a localized message from a resource bundle.',
        attributes: '**key** (required) - Message key\n\n**bundle** - Resource bundle\n\n**var** - Store in variable',
        example: '```jsp\n<fmt:message key="welcome.title"/>\n```'
    },
    'jsp:include': {
        description: 'Includes a resource (JSP, HTML, servlet) at request time. Unlike <%@ include %>, this is dynamic.',
        attributes: '**page** (required) - Resource path\n\n**flush** - Flush buffer before include',
        example: '```jsp\n<jsp:include page="/WEB-INF/views/header.jsp">\n    <jsp:param name="title" value="Home"/>\n</jsp:include>\n```'
    },
    'jsp:forward': {
        description: 'Forwards the request to another resource. The current page\'s output is discarded.',
        attributes: '**page** (required) - Target resource path',
        example: '```jsp\n<jsp:forward page="/WEB-INF/views/error.jsp"/>\n```'
    },
    'jsp:useBean': {
        description: 'Locates or instantiates a JavaBean component.',
        attributes: '**id** (required) - Bean reference name\n\n**class** - Bean class\n\n**scope** - page|request|session|application\n\n**type** - Variable type',
        example: '```jsp\n<jsp:useBean id="user" class="com.example.User" scope="session"/>\n```'
    },
};

const EL_IMPLICIT_DOCS: Record<string, string> = {
    'pageScope': 'Maps page-scoped attribute names to their values. Equivalent to pageContext.getAttribute(name, PAGE_SCOPE).',
    'requestScope': 'Maps request-scoped attribute names to values. Access with ${requestScope.myAttr}.',
    'sessionScope': 'Maps session-scoped attributes. Access with ${sessionScope.user}.',
    'applicationScope': 'Maps application-scoped attributes. Shared across all sessions.',
    'param': 'Maps request parameter names to single String values. ${param.name} = request.getParameter("name").',
    'paramValues': 'Maps request parameter names to String arrays for multi-valued parameters.',
    'header': 'Maps HTTP request header names to single String values.',
    'headerValues': 'Maps HTTP request header names to String arrays.',
    'cookie': 'Maps cookie names to Cookie objects. Access value with ${cookie.name.value}.',
    'initParam': 'Maps context initialization parameter names to their values.',
    'pageContext': 'The PageContext object. Provides access to request, response, session, etc.',
};

export class JspHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | undefined {
        const range = document.getWordRangeAtPosition(position, /[a-zA-Z_:][a-zA-Z0-9_:]*/);
        if (!range) return undefined;

        const word = document.getText(range);
        const lineText = document.lineAt(position.line).text;

        // Check for JSTL/JSP tags: look for <prefix:tagName pattern
        const tagMatch = lineText.match(new RegExp(`<(\\/?)(${word.replace(':', '\\:')})`, 'i'));
        if (tagMatch) {
            const tagName = word.replace(/^\//, '');
            const doc = TAG_DOCS[tagName];
            if (doc) {
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`## \`<${tagName}>\`\n\n`);
                md.appendMarkdown(`${doc.description}\n\n`);
                md.appendMarkdown(`### Attributes\n\n${doc.attributes}\n\n`);
                md.appendMarkdown(`### Example\n\n${doc.example}`);
                return new vscode.Hover(md, range);
            }
        }

        // Check for tag with prefix:name format in tag context
        const prefixTagMatch = lineText.match(/<(c|fmt|sql|x|jsp|form):(\w+)/);
        if (prefixTagMatch) {
            const fullTag = `${prefixTagMatch[1]}:${prefixTagMatch[2]}`;
            if (word === prefixTagMatch[2] || word === fullTag) {
                const doc = TAG_DOCS[fullTag];
                if (doc) {
                    const md = new vscode.MarkdownString();
                    md.appendMarkdown(`## \`<${fullTag}>\`\n\n`);
                    md.appendMarkdown(`${doc.description}\n\n`);
                    md.appendMarkdown(`### Attributes\n\n${doc.attributes}\n\n`);
                    md.appendMarkdown(`### Example\n\n${doc.example}`);
                    return new vscode.Hover(md, range);
                }
            }
        }

        // Check for EL implicit objects
        const elDoc = EL_IMPLICIT_DOCS[word];
        if (elDoc) {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`## EL Implicit Object: \`${word}\`\n\n`);
            md.appendMarkdown(elDoc);
            return new vscode.Hover(md, range);
        }

        // Check for JSP directives
        if (lineText.includes('<%@')) {
            const directives: Record<string, string> = {
                'page': 'Defines page-level attributes: content type, encoding, imports, error handling, session participation.',
                'include': 'Statically includes a file at translation time. The included file becomes part of this JSP.',
                'taglib': 'Declares a custom tag library with a prefix for use in this page.',
                'tag': 'Defines attributes for a tag file (used in .tag files only).',
                'attribute': 'Declares an attribute for a custom tag file.',
                'variable': 'Declares a scripting variable exposed by a tag file.',
            };
            if (directives[word]) {
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`## JSP Directive: \`<%@ ${word} %>\`\n\n`);
                md.appendMarkdown(directives[word]);
                return new vscode.Hover(md, range);
            }
        }

        return undefined;
    }
}
