import * as vscode from 'vscode';

export class JspCompletionProvider implements vscode.CompletionItemProvider {
    private enableJSTL: boolean;
    private enableEL: boolean;
    private enableDirectives: boolean;

    constructor(config: vscode.WorkspaceConfiguration) {
        this.enableJSTL = config.get<boolean>('completion.enableJSTL', true);
        this.enableEL = config.get<boolean>('completion.enableEL', true);
        this.enableDirectives = config.get<boolean>('completion.enableDirectives', true);
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const items: vscode.CompletionItem[] = [];

        if (this.isInsideEL(document, position) && this.enableEL) {
            return this.getELCompletions(linePrefix);
        }
        if (this.enableDirectives && linePrefix.match(/<%@\s*$/)) {
            return this.getDirectiveCompletions();
        }
        if (this.enableDirectives && linePrefix.match(/<%@\s*(\w+)\s+/)) {
            return this.getDirectiveAttrCompletions(linePrefix.match(/<%@\s*(\w+)/)?.[1] || '');
        }
        if (linePrefix.match(/<\s*$/)) { return this.getTagPrefixes(); }
        if (linePrefix.match(/<c:\s*$/)) { return this.getJSTLCore(); }
        if (linePrefix.match(/<fmt:\s*$/)) { return this.getJSTLFmt(); }
        if (linePrefix.match(/<sql:\s*$/)) { return this.getJSTLSql(); }
        if (linePrefix.match(/<x:\s*$/)) { return this.getJSTLXml(); }
        if (linePrefix.match(/<jsp:\s*$/)) { return this.getJspActions(); }
        if (linePrefix.match(/<form:\s*$/)) { return this.getSpringForm(); }

        // Tag attributes
        const tagMatch = linePrefix.match(/<(c|fmt|sql|x|jsp|form):(\w+)\s+(?:[^>]*)$/);
        if (tagMatch) {
            return this.getTagAttrs(`${tagMatch[1]}:${tagMatch[2]}`);
        }

        // EL trigger
        if (this.enableEL && linePrefix.endsWith('$')) {
            const item = new vscode.CompletionItem('${...}', vscode.CompletionItemKind.Snippet);
            item.insertText = new vscode.SnippetString('{${1:expression}}');
            item.detail = 'EL Expression';
            items.push(item);
        }

        return items;
    }

    private isInsideEL(doc: vscode.TextDocument, pos: vscode.Position): boolean {
        const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), pos));
        const lastOpen = Math.max(text.lastIndexOf('${'), text.lastIndexOf('#{'));
        if (lastOpen === -1) return false;
        return lastOpen > text.lastIndexOf('}');
    }

    private getELCompletions(linePrefix: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        // Implicit objects
        const implicitObjs: [string, string][] = [
            ['pageScope', 'Page scope attributes map'],
            ['requestScope', 'Request scope attributes map'],
            ['sessionScope', 'Session scope attributes map'],
            ['applicationScope', 'Application scope attributes map'],
            ['param', 'Request parameters (single value)'],
            ['paramValues', 'Request parameters (array)'],
            ['header', 'HTTP headers (single value)'],
            ['headerValues', 'HTTP headers (array)'],
            ['cookie', 'Cookies map'],
            ['initParam', 'Context init parameters'],
            ['pageContext', 'PageContext object'],
        ];
        for (const [name, desc] of implicitObjs) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
            item.detail = 'EL Implicit Object';
            item.documentation = desc;
            items.push(item);
        }

        // Keywords
        for (const kw of ['true', 'false', 'null', 'empty', 'not', 'and', 'or', 'eq', 'ne', 'lt', 'gt', 'le', 'ge', 'div', 'mod', 'instanceof']) {
            items.push(Object.assign(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword), { detail: 'EL Keyword' }));
        }

        // fn: functions
        const fns: [string, string, string][] = [
            ['fn:length', 'fn:length(obj)', 'Length of collection/string'],
            ['fn:toUpperCase', 'fn:toUpperCase(str)', 'Uppercase'],
            ['fn:toLowerCase', 'fn:toLowerCase(str)', 'Lowercase'],
            ['fn:substring', 'fn:substring(str, begin, end)', 'Substring'],
            ['fn:trim', 'fn:trim(str)', 'Trim whitespace'],
            ['fn:replace', 'fn:replace(str, before, after)', 'Replace'],
            ['fn:indexOf', 'fn:indexOf(str, sub)', 'Index of'],
            ['fn:contains', 'fn:contains(str, sub)', 'Contains check'],
            ['fn:containsIgnoreCase', 'fn:containsIgnoreCase(str, sub)', 'Case-insensitive contains'],
            ['fn:startsWith', 'fn:startsWith(str, prefix)', 'Starts with'],
            ['fn:endsWith', 'fn:endsWith(str, suffix)', 'Ends with'],
            ['fn:split', 'fn:split(str, delim)', 'Split string'],
            ['fn:join', 'fn:join(arr, sep)', 'Join array'],
            ['fn:escapeXml', 'fn:escapeXml(str)', 'Escape XML chars'],
            ['fn:substringAfter', 'fn:substringAfter(str, sub)', 'After first occurrence'],
            ['fn:substringBefore', 'fn:substringBefore(str, sub)', 'Before first occurrence'],
        ];
        for (const [name, sig, desc] of fns) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
            item.detail = sig;
            item.documentation = desc;
            item.insertText = new vscode.SnippetString(`${name}(\${1})`);
            items.push(item);
        }

        // pageContext sub-properties
        if (linePrefix.match(/pageContext\.\s*$/)) {
            for (const p of ['request', 'response', 'session', 'servletContext', 'servletConfig', 'out', 'exception', 'page']) {
                items.push(new vscode.CompletionItem(p, vscode.CompletionItemKind.Property));
            }
        }
        if (linePrefix.match(/pageContext\.request\.\s*$/)) {
            for (const p of ['contextPath', 'servletPath', 'pathInfo', 'queryString', 'method', 'contentType', 'remoteAddr', 'serverName', 'serverPort', 'requestURI', 'locale', 'scheme']) {
                items.push(new vscode.CompletionItem(p, vscode.CompletionItemKind.Property));
            }
        }

        return items;
    }

    private getDirectiveCompletions(): vscode.CompletionItem[] {
        return ['page', 'include', 'taglib', 'tag', 'attribute', 'variable'].map(d => {
            const item = new vscode.CompletionItem(d, vscode.CompletionItemKind.Keyword);
            item.detail = `<%@ ${d} %>`;
            return item;
        });
    }

    private getDirectiveAttrCompletions(directive: string): vscode.CompletionItem[] {
        const map: Record<string, [string, string[]][]> = {
            page: [
                ['language', ['java']], ['contentType', []], ['pageEncoding', ['UTF-8', 'EUC-KR']],
                ['import', []], ['session', ['true', 'false']], ['errorPage', []],
                ['isErrorPage', ['true', 'false']], ['isELIgnored', ['false', 'true']],
                ['buffer', ['8kb', '16kb', 'none']], ['autoFlush', ['true', 'false']],
                ['trimDirectiveWhitespaces', ['true', 'false']],
            ],
            include: [['file', []]],
            taglib: [['prefix', []], ['uri', []], ['tagdir', []]],
            tag: [['display-name', []], ['body-content', ['empty', 'scriptless', 'tagdependent']], ['description', []]],
            attribute: [['name', []], ['required', ['true', 'false']], ['rtexprvalue', ['true', 'false']], ['type', []]],
            variable: [['name-given', []], ['variable-class', []], ['scope', ['AT_BEGIN', 'AT_END', 'NESTED']]],
        };
        return (map[directive] || []).map(([name, vals]) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
            item.insertText = vals.length > 0
                ? new vscode.SnippetString(`${name}="\${1|${vals.join(',')}|}"`)
                : new vscode.SnippetString(`${name}="\${1}"`);
            return item;
        });
    }

    private getTagPrefixes(): vscode.CompletionItem[] {
        return [
            ['c:', 'JSTL Core'], ['fmt:', 'JSTL Format'], ['fn:', 'JSTL Functions'],
            ['sql:', 'JSTL SQL'], ['x:', 'JSTL XML'], ['jsp:', 'JSP Actions'],
            ['form:', 'Spring Form'], ['spring:', 'Spring Tags'],
        ].map(([prefix, desc]) => {
            const item = new vscode.CompletionItem(prefix as string, vscode.CompletionItemKind.Module);
            item.detail = desc as string;
            item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger' };
            return item;
        });
    }

    private makeTagItem(tag: string, prefix: string, doc: string, snippet: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Property);
        item.detail = `${prefix}:${tag}`;
        item.documentation = doc;
        item.insertText = new vscode.SnippetString(snippet);
        return item;
    }

    private getJSTLCore(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('out', 'c', 'Output expression', 'out value="${${1:expr}}" ${2:escapeXml="true"}/>'),
            this.makeTagItem('set', 'c', 'Set variable', 'set var="${1:name}" value="${${2:expr}}"/>'),
            this.makeTagItem('remove', 'c', 'Remove variable', 'remove var="${1:name}"/>'),
            this.makeTagItem('if', 'c', 'Conditional', 'if test="${${1:condition}}">\n\t${2}\n</c:if>'),
            this.makeTagItem('choose', 'c', 'Switch/case', 'choose>\n\t<c:when test="${${1:condition}}">\n\t\t${2}\n\t</c:when>\n\t<c:otherwise>\n\t\t${3}\n\t</c:otherwise>\n</c:choose>'),
            this.makeTagItem('when', 'c', 'Case clause', 'when test="${${1:condition}}">\n\t${2}\n</c:when>'),
            this.makeTagItem('otherwise', 'c', 'Default clause', 'otherwise>\n\t${1}\n</c:otherwise>'),
            this.makeTagItem('forEach', 'c', 'Loop', 'forEach var="${1:item}" items="${${2:list}}" varStatus="${3:status}">\n\t${4}\n</c:forEach>'),
            this.makeTagItem('forTokens', 'c', 'Token iteration', 'forTokens var="${1:token}" items="${${2:str}}" delims="${3:,}">\n\t${4}\n</c:forTokens>'),
            this.makeTagItem('import', 'c', 'Import URL content', 'import url="${1:url}" var="${2:content}"/>'),
            this.makeTagItem('url', 'c', 'URL rewrite', 'url value="${1:/path}" var="${2:url}">\n\t<c:param name="${3:key}" value="${${4:val}}"/>\n</c:url>'),
            this.makeTagItem('redirect', 'c', 'HTTP redirect', 'redirect url="${1:/path}"/>'),
            this.makeTagItem('catch', 'c', 'Exception handling', 'catch var="${1:ex}">\n\t${2}\n</c:catch>'),
            this.makeTagItem('param', 'c', 'URL parameter', 'param name="${1:name}" value="${${2:value}}"/>'),
        ];
    }

    private getJSTLFmt(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('message', 'fmt', 'i18n message', 'message key="${1:key}"/>'),
            this.makeTagItem('formatNumber', 'fmt', 'Number formatting', 'formatNumber value="${${1:num}}" type="${2|number,currency,percent|}"/>'),
            this.makeTagItem('parseNumber', 'fmt', 'Parse number', 'parseNumber value="${${1:str}}" var="${2:num}"/>'),
            this.makeTagItem('formatDate', 'fmt', 'Date formatting', 'formatDate value="${${1:date}}" pattern="${2:yyyy-MM-dd HH:mm:ss}"/>'),
            this.makeTagItem('parseDate', 'fmt', 'Parse date', 'parseDate value="${${1:str}}" pattern="${2:yyyy-MM-dd}" var="${3:date}"/>'),
            this.makeTagItem('setLocale', 'fmt', 'Set locale', 'setLocale value="${1:ko_KR}"/>'),
            this.makeTagItem('bundle', 'fmt', 'Resource bundle scope', 'bundle basename="${1:messages}">\n\t${2}\n</fmt:bundle>'),
            this.makeTagItem('setBundle', 'fmt', 'Set bundle', 'setBundle basename="${1:messages}" var="${2:bundle}"/>'),
            this.makeTagItem('timeZone', 'fmt', 'Time zone scope', 'timeZone value="${1:Asia/Seoul}">\n\t${2}\n</fmt:timeZone>'),
            this.makeTagItem('setTimeZone', 'fmt', 'Set time zone', 'setTimeZone value="${1:Asia/Seoul}"/>'),
            this.makeTagItem('requestEncoding', 'fmt', 'Set encoding', 'requestEncoding value="${1:UTF-8}"/>'),
        ];
    }

    private getJSTLSql(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('query', 'sql', 'SELECT query', 'query var="${1:result}" dataSource="${${2:ds}}">\n\t${3:SELECT * FROM table}\n</sql:query>'),
            this.makeTagItem('update', 'sql', 'UPDATE/INSERT/DELETE', 'update dataSource="${${1:ds}}">\n\t${2:UPDATE table SET col=?}\n\t<sql:param value="${${3:val}}"/>\n</sql:update>'),
            this.makeTagItem('transaction', 'sql', 'Transaction scope', 'transaction dataSource="${${1:ds}}">\n\t${2}\n</sql:transaction>'),
            this.makeTagItem('setDataSource', 'sql', 'Configure data source', 'setDataSource var="${1:ds}" driver="${2:com.mysql.cj.jdbc.Driver}" url="${3:jdbc:mysql://localhost/db}" user="${4:root}" password="${5}"/>'),
            this.makeTagItem('param', 'sql', 'SQL parameter', 'param value="${${1:val}}"/>'),
            this.makeTagItem('dateParam', 'sql', 'SQL date param', 'dateParam value="${${1:date}}" type="${2|date,time,timestamp|}"/>'),
        ];
    }

    private getJSTLXml(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('parse', 'x', 'Parse XML', 'parse var="${1:doc}" xml="${${2:xmlString}}"/>'),
            this.makeTagItem('out', 'x', 'Output XPath', 'out select="${1:xpath}"/>'),
            this.makeTagItem('set', 'x', 'Set from XPath', 'set var="${1:name}" select="${2:xpath}"/>'),
            this.makeTagItem('if', 'x', 'XPath condition', 'if select="${1:xpath}">\n\t${2}\n</x:if>'),
            this.makeTagItem('forEach', 'x', 'Iterate XPath', 'forEach var="${1:node}" select="${2:xpath}">\n\t${3}\n</x:forEach>'),
            this.makeTagItem('transform', 'x', 'XSLT transform', 'transform xml="${${1:doc}}" xslt="${${2:xslt}}"/>'),
        ];
    }

    private getJspActions(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('include', 'jsp', 'Dynamic include', 'include page="${1:page.jsp}"/>'),
            this.makeTagItem('forward', 'jsp', 'Forward request', 'forward page="${1:page.jsp}"/>'),
            this.makeTagItem('useBean', 'jsp', 'JavaBean declaration', 'useBean id="${1:bean}" class="${2:com.example.Bean}" scope="${3|page,request,session,application|}"/>'),
            this.makeTagItem('setProperty', 'jsp', 'Set bean property', 'setProperty name="${1:bean}" property="${2:*}"/>'),
            this.makeTagItem('getProperty', 'jsp', 'Get bean property', 'getProperty name="${1:bean}" property="${2:prop}"/>'),
            this.makeTagItem('param', 'jsp', 'Request parameter', 'param name="${1:name}" value="${2:value}"/>'),
        ];
    }

    private getSpringForm(): vscode.CompletionItem[] {
        return [
            this.makeTagItem('form', 'form', 'HTML form with binding', 'form modelAttribute="${1:formBean}" action="${2:/submit}" method="${3|post,get|}">\n\t${4}\n</form:form>'),
            this.makeTagItem('input', 'form', 'Text input', 'input path="${1:field}" cssClass="${2:form-control}"/>'),
            this.makeTagItem('password', 'form', 'Password input', 'password path="${1:field}" cssClass="${2:form-control}"/>'),
            this.makeTagItem('textarea', 'form', 'Textarea', 'textarea path="${1:field}" rows="${2:5}" cssClass="${3:form-control}"/>'),
            this.makeTagItem('select', 'form', 'Select dropdown', 'select path="${1:field}" cssClass="${2:form-control}">\n\t<form:option value="" label="-- 선택 --"/>\n\t<form:options items="${${3:list}}" itemValue="${4:id}" itemLabel="${5:name}"/>\n</form:select>'),
            this.makeTagItem('checkbox', 'form', 'Checkbox', 'checkbox path="${1:field}" value="${2:value}"/>'),
            this.makeTagItem('radiobutton', 'form', 'Radio button', 'radiobutton path="${1:field}" value="${2:value}"/>'),
            this.makeTagItem('hidden', 'form', 'Hidden input', 'hidden path="${1:field}"/>'),
            this.makeTagItem('errors', 'form', 'Validation errors', 'errors path="${1:field}" cssClass="${2:text-danger}"/>'),
            this.makeTagItem('label', 'form', 'Form label', 'label path="${1:field}">${2:Label}</form:label>'),
        ];
    }

    private getTagAttrs(fullTag: string): vscode.CompletionItem[] {
        const attrMap: Record<string, [string, string[]][]> = {
            'c:out': [['value', []], ['default', []], ['escapeXml', ['true', 'false']]],
            'c:set': [['var', []], ['value', []], ['scope', ['page', 'request', 'session', 'application']], ['target', []], ['property', []]],
            'c:if': [['test', []], ['var', []], ['scope', ['page', 'request', 'session', 'application']]],
            'c:forEach': [['var', []], ['items', []], ['varStatus', []], ['begin', []], ['end', []], ['step', []]],
            'c:forTokens': [['var', []], ['items', []], ['delims', []], ['varStatus', []]],
            'c:import': [['url', []], ['var', []], ['scope', ['page', 'request', 'session', 'application']], ['charEncoding', []]],
            'c:url': [['value', []], ['var', []], ['scope', ['page', 'request', 'session', 'application']]],
            'c:redirect': [['url', []]],
            'c:catch': [['var', []]],
            'c:param': [['name', []], ['value', []]],
            'c:remove': [['var', []], ['scope', ['page', 'request', 'session', 'application']]],
            'fmt:message': [['key', []], ['bundle', []], ['var', []]],
            'fmt:formatNumber': [['value', []], ['type', ['number', 'currency', 'percent']], ['pattern', []], ['var', []], ['currencyCode', []]],
            'fmt:formatDate': [['value', []], ['type', ['date', 'time', 'both']], ['pattern', []], ['var', []], ['timeZone', []]],
            'fmt:setLocale': [['value', []]],
            'fmt:bundle': [['basename', []]],
            'fmt:setBundle': [['basename', []], ['var', []]],
            'fmt:timeZone': [['value', []]],
            'jsp:include': [['page', []], ['flush', ['true', 'false']]],
            'jsp:forward': [['page', []]],
            'jsp:useBean': [['id', []], ['class', []], ['scope', ['page', 'request', 'session', 'application']], ['type', []]],
            'jsp:setProperty': [['name', []], ['property', []], ['value', []], ['param', []]],
            'jsp:getProperty': [['name', []], ['property', []]],
            'jsp:param': [['name', []], ['value', []]],
            'form:form': [['modelAttribute', []], ['action', []], ['method', ['post', 'get']], ['cssClass', []], ['enctype', ['multipart/form-data']]],
            'form:input': [['path', []], ['cssClass', []], ['id', []], ['placeholder', []], ['maxlength', []], ['readonly', ['true', 'false']]],
            'form:select': [['path', []], ['items', []], ['itemValue', []], ['itemLabel', []], ['cssClass', []]],
            'form:textarea': [['path', []], ['rows', []], ['cols', []], ['cssClass', []]],
            'form:checkbox': [['path', []], ['value', []], ['label', []]],
            'form:radiobutton': [['path', []], ['value', []], ['label', []]],
            'form:hidden': [['path', []]],
            'form:errors': [['path', []], ['cssClass', []], ['element', []]],
        };

        return (attrMap[fullTag] || []).map(([name, vals]) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
            item.insertText = vals.length > 0
                ? new vscode.SnippetString(`${name}="\${1|${vals.join(',')}|}"`)
                : new vscode.SnippetString(`${name}="\${1}"`);
            return item;
        });
    }
}
