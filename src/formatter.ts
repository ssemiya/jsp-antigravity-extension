import * as vscode from 'vscode';

export class JspFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        return this.formatRange(document, fullRange, options);
    }

    provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        return this.formatRange(document, range, options);
    }

    private formatRange(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const config = vscode.workspace.getConfiguration('jspComplete');
        const tabSize = config.get<number>('format.tabSize', options.tabSize);
        const insertSpaces = config.get<boolean>('format.insertSpaces', options.insertSpaces);
        const preserveNewlines = config.get<boolean>('format.preserveNewlines', true);
        const maxPreserveNewlines = config.get<number>('format.maxPreserveNewlines', 2);
        const wrapLineLength = config.get<number>('format.wrapLineLength', 120);

        const text = document.getText(range);
        const formatted = this.formatJsp(text, {
            tabSize,
            insertSpaces,
            preserveNewlines,
            maxPreserveNewlines,
            wrapLineLength
        });

        if (formatted === text) {
            return [];
        }

        return [vscode.TextEdit.replace(range, formatted)];
    }

    private formatJsp(text: string, options: FormatOptions): string {
        // Preserve JSP comments, scriptlets, expressions, declarations
        const preserveMap = new Map<string, string>();
        let counter = 0;

        // Preserve JSP comments
        text = text.replace(/<%--[\s\S]*?--%>/g, (match) => {
            const key = `__JSP_COMMENT_${counter++}__`;
            preserveMap.set(key, this.formatJspComment(match, options));
            return key;
        });

        // Preserve JSP declarations (<%! ... %>)
        text = text.replace(/<%![\s\S]*?%>/g, (match) => {
            const key = `__JSP_DECL_${counter++}__`;
            preserveMap.set(key, this.formatJspBlock(match, options));
            return key;
        });

        // Preserve JSP expressions (<%= ... %>)
        text = text.replace(/<%=[\s\S]*?%>/g, (match) => {
            const key = `__JSP_EXPR_${counter++}__`;
            preserveMap.set(key, match.replace(/\s+/g, ' ').trim());
            return key;
        });

        // Preserve JSP scriptlets (<% ... %>)
        text = text.replace(/<%(?![=!@-])[\s\S]*?%>/g, (match) => {
            const key = `__JSP_SCRIPT_${counter++}__`;
            preserveMap.set(key, this.formatJspBlock(match, options));
            return key;
        });

        // Preserve JSP directives (<%@ ... %>)
        text = text.replace(/<%@[\s\S]*?%>/g, (match) => {
            const key = `__JSP_DIR_${counter++}__`;
            preserveMap.set(key, this.formatDirective(match));
            return key;
        });

        // Preserve EL expressions
        text = text.replace(/\$\{[^}]*\}/g, (match) => {
            const key = `__EL_${counter++}__`;
            preserveMap.set(key, match);
            return key;
        });

        text = text.replace(/#\{[^}]*\}/g, (match) => {
            const key = `__DEL_${counter++}__`;
            preserveMap.set(key, match);
            return key;
        });

        // Preserve <script> blocks
        text = text.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
            const key = `__SCRIPT_${counter++}__`;
            preserveMap.set(key, match);
            return key;
        });

        // Preserve <style> blocks
        text = text.replace(/<style[\s\S]*?<\/style>/gi, (match) => {
            const key = `__STYLE_${counter++}__`;
            preserveMap.set(key, match);
            return key;
        });

        // Now format HTML/JSP tag structure
        text = this.formatHtmlStructure(text, options);

        // Restore preserved content
        for (const [key, value] of preserveMap) {
            text = text.replace(key, value);
        }

        // Handle newlines
        if (options.preserveNewlines) {
            const maxNewlines = '\n'.repeat(options.maxPreserveNewlines + 1);
            const regex = new RegExp(`\n{${options.maxPreserveNewlines + 2},}`, 'g');
            text = text.replace(regex, maxNewlines);
        }

        // Ensure single newline at end
        text = text.replace(/\s+$/, '\n');

        return text;
    }

    private formatHtmlStructure(text: string, options: FormatOptions): string {
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        const lines = text.split('\n');
        const result: string[] = [];
        let level = 0;

        // Tags that increase indent
        const openTags = /^<(?!\/|!|br|hr|img|input|link|meta|area|base|col|embed|param|source|track|wbr|jsp:(?:include|forward|param|setProperty|getProperty|useBean)|c:(?:out|set|remove|param|redirect)|fmt:(?:message|formatNumber|formatDate|setLocale|setBundle|requestEncoding|setTimeZone)|sql:(?:param|dateParam|setDataSource))[a-zA-Z:][^>]*[^\/]>$/;
        const closeTags = /^<\/[a-zA-Z:][^>]*>$/;
        const selfCloseTags = /^<[a-zA-Z:][^>]*\/>$/;

        // JSP/JSTL tags that affect indentation
        const jspOpenTags = /^<(c:(?:if|choose|when|otherwise|forEach|forTokens|catch|import|url)|fmt:(?:bundle|timeZone)|sql:(?:query|update|transaction)|x:(?:parse|if|choose|when|otherwise|forEach|transform)|jsp:(?:include|forward|useBean|element|body|attribute))[^>]*[^\/]>/;
        const jspCloseTags = /^<\/(c:(?:if|choose|when|otherwise|forEach|forTokens|catch|import|url)|fmt:(?:bundle|timeZone)|sql:(?:query|update|transaction)|x:(?:parse|if|choose|when|otherwise|forEach|transform)|jsp:(?:include|forward|useBean|element|body|attribute))>/;

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (trimmed === '') {
                result.push('');
                continue;
            }

            // Decrease indent for closing tags
            if (closeTags.test(trimmed) || jspCloseTags.test(trimmed)) {
                level = Math.max(0, level - 1);
            }

            result.push(indent.repeat(level) + trimmed);

            // Increase indent for opening tags (not self-closing)
            if (!selfCloseTags.test(trimmed)) {
                if (openTags.test(trimmed) || jspOpenTags.test(trimmed)) {
                    level++;
                }
            }
        }

        return result.join('\n');
    }

    private formatDirective(directive: string): string {
        // Single line directives stay single line
        const content = directive.replace(/\s+/g, ' ').trim();
        if (content.length <= 120) {
            return content;
        }

        // Multi-line for long directives
        const match = content.match(/^(<%@\s*\w+)\s+(.*)\s*(%>)$/);
        if (!match) { return content; }

        const [, prefix, attrs, suffix] = match;
        const attrPairs = attrs.match(/\w+(?::\w+)?="[^"]*"/g) || [];

        if (attrPairs.length <= 1) { return content; }

        const lines = [prefix];
        for (const attr of attrPairs) {
            lines.push('    ' + attr);
        }
        lines[lines.length - 1] += ' ' + suffix;

        return lines.join('\n');
    }

    private formatJspComment(comment: string, options: FormatOptions): string {
        const content = comment.slice(4, -4).trim();
        if (content.indexOf('\n') === -1 && content.length < 80) {
            return `<%-- ${content} --%>`;
        }
        return comment;
    }

    private formatJspBlock(block: string, options: FormatOptions): string {
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        const isDecl = block.startsWith('<%!');
        const prefix = isDecl ? '<%!' : '<%';
        const content = block.slice(prefix.length, -2).trim();

        // 짧은 단일 문장은 한 줄로
        if (content.indexOf('\n') === -1 && content.length < 60 &&
            !content.includes('{') && (content.match(/;/g) || []).length <= 1) {
            return `${prefix} ${content} %>`;
        }

        // Java 코드 포매팅
        const formatted = this.formatJavaCode(content, indent);
        return `${prefix}\n${formatted}\n%>`;
    }

    private formatJavaCode(code: string, indent: string): string {
        // 문자열 리터럴 보존
        const stringMap = new Map<string, string>();
        let stringCounter = 0;

        code = code.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
            const key = `__STR_${stringCounter++}__`;
            stringMap.set(key, match);
            return key;
        });

        // 줄바꿈 정규화
        code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 세미콜론 뒤에 줄바꿈 추가 (for문 제외)
        code = code.replace(/;(?!\s*\n)/g, ';\n');

        // { 뒤에 줄바꿈
        code = code.replace(/\{(?!\s*\n)/g, '{\n');

        // } 앞에 줄바꿈
        code = code.replace(/(?<!\n\s*)\}/g, '\n}');

        // } 뒤에 줄바꿈 (else, catch, finally 제외)
        code = code.replace(/\}(?!\s*(?:else|catch|finally|\n))/g, '}\n');

        // for문 내부 세미콜론 복원 (줄바꿈 제거)
        code = code.replace(/for\s*\([^)]*\)/g, (match) => {
            return match.replace(/;\n/g, '; ');
        });

        // 줄 단위로 분리하고 들여쓰기 적용
        const lines = code.split('\n');
        const result: string[] = [];
        let level = 1; // JSP 블록 내부이므로 기본 1레벨

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (trimmed === '') {
                result.push('');
                continue;
            }

            // } 로 시작하면 들여쓰기 감소
            if (trimmed.startsWith('}')) {
                level = Math.max(1, level - 1);
            }

            result.push(indent.repeat(level) + trimmed);

            // { 로 끝나면 들여쓰기 증가
            if (trimmed.endsWith('{')) {
                level++;
            }
        }

        // 문자열 리터럴 복원
        let formatted = result.join('\n');
        for (const [key, value] of stringMap) {
            formatted = formatted.replace(key, value);
        }

        return formatted;
    }
}

interface FormatOptions {
    tabSize: number;
    insertSpaces: boolean;
    preserveNewlines: boolean;
    maxPreserveNewlines: number;
    wrapLineLength: number;
}
