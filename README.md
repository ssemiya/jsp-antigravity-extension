# JSP Complete - Google Antigravity / VS Code Extension

JSP (Jakarta Server Pages) 파일에 대한 완전한 언어 지원을 제공하는 Google Antigravity / VS Code 확장입니다.

## ✨ 주요 기능

### 1. 구문 강조 (Syntax Highlighting)
- JSP 스크립틀릿 (`<% %>`, `<%= %>`, `<%! %>`)
- JSP 디렉티브 (`<%@ page %>`, `<%@ taglib %>`, `<%@ include %>`)
- JSP 주석 (`<%-- --%>`)
- EL 표현식 (`${...}`, `#{...}`)
- JSTL 태그 (Core, Fmt, Functions, SQL, XML)
- JSP 액션 태그 (`<jsp:include>`, `<jsp:forward>` 등)
- Spring Form 태그 (`<form:form>`, `<form:input>` 등)
- 내장 Java/HTML/CSS/JavaScript 하이라이팅

### 2. 자동완성 (IntelliSense)
- **JSP 디렉티브**: page, include, taglib 및 속성 자동완성
- **JSTL Core**: `c:if`, `c:forEach`, `c:choose`, `c:set`, `c:out` 등
- **JSTL Format**: `fmt:formatDate`, `fmt:formatNumber`, `fmt:message` 등
- **JSTL SQL**: `sql:query`, `sql:update`, `sql:setDataSource` 등
- **JSTL XML**: `x:parse`, `x:out`, `x:forEach` 등
- **JSP Actions**: `jsp:include`, `jsp:forward`, `jsp:useBean` 등
- **Spring Form**: `form:form`, `form:input`, `form:select`, `form:errors` 등
- **EL 표현식**: 암시적 객체, fn: 함수, pageContext 속성
- **태그 속성**: 각 태그의 속성을 자동으로 제안

### 3. 포매팅 (Formatting)
- HTML/JSP 태그 구조 자동 들여쓰기
- JSTL 태그 들여쓰기 지원
- JSP 스크립틀릿 내 Java 코드 포매팅
- JSP 디렉티브 정렬
- 설정 가능한 탭 크기, 공백/탭, 줄 바꿈 등

### 4. 진단/검증 (Diagnostics)
- 닫히지 않은 JSP 태그 (`<%`, `<%--`) 감지
- 닫히지 않은 EL 표현식 감지
- 누락된 taglib 선언 경고
- 닫히지 않은 JSTL 태그 감지
- 스크립틀릿 대신 JSTL/EL 사용 권장
- `c:out` value 속성 누락 감지
- 중복 page 디렉티브 감지

### 5. 호버 문서 (Hover Documentation)
- JSTL/JSP 태그 위에 마우스를 올리면 설명, 속성, 예제 표시
- EL 암시적 객체 설명
- JSP 디렉티브 설명

### 6. 코드 스니펫 (Snippets)
- 80+ 코드 스니펫 포함
- JSP 페이지 템플릿, 테이블, 페이지네이션 등
- JSTL, Spring Form, EL 함수 스니펫
- `jsptemplate` → 전체 JSP 페이지 뼈대
- `cif`, `cforeach`, `cchoose` → JSTL 조건/반복
- `fmtdate`, `fmtnumber` → 포매팅
- `formform`, `forminput` → Spring Form

## 📦 설치 방법

### Google Antigravity (VSIX 수동 설치)
1. `Shift + Cmd + P` (명령 팔레트 열기)
2. `Extensions: Install from VSIX...` 입력
3. `jsp-complete-1.0.0.vsix` 파일 선택

### VS Code
1. Extensions 패널 열기 (`Ctrl+Shift+X`)
2. "JSP Complete" 검색 후 설치

또는 VSIX 수동 설치:
```bash
code --install-extension jsp-complete-1.0.0.vsix
```

## ⚙️ 설정 (Settings)

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `jspComplete.format.enable` | `true` | 포매팅 활성화 |
| `jspComplete.format.tabSize` | `4` | 탭 크기 |
| `jspComplete.format.insertSpaces` | `true` | 공백 사용 |
| `jspComplete.format.preserveNewlines` | `true` | 빈 줄 유지 |
| `jspComplete.format.maxPreserveNewlines` | `2` | 최대 연속 빈 줄 수 |
| `jspComplete.format.wrapLineLength` | `120` | 줄 바꿈 길이 |
| `jspComplete.completion.enableJSTL` | `true` | JSTL 자동완성 |
| `jspComplete.completion.enableEL` | `true` | EL 자동완성 |
| `jspComplete.completion.enableDirectives` | `true` | 디렉티브 자동완성 |
| `jspComplete.validation.enable` | `true` | 진단 활성화 |

## 🔤 지원 파일 확장자

- `.jsp` - Java Server Pages
- `.jspf` - JSP Fragment
- `.jspx` - JSP Document (XML)
- `.tag` - Tag File
- `.tagf` - Tag Fragment
- `.tagx` - Tag Document (XML)

## 📝 스니펫 예시

### 페이지 템플릿 (`jsptemplate`)
```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Page Title</title>
</head>
<body>
    <jsp:include page="/WEB-INF/views/common/header.jsp"/>
    <div class="container">
        <!-- content -->
    </div>
    <jsp:include page="/WEB-INF/views/common/footer.jsp"/>
</body>
</html>
```

### 테이블 (`jsptable`)
```jsp
<table class="table">
    <thead>
        <tr><th>No</th><th>이름</th><th>값</th></tr>
    </thead>
    <tbody>
        <c:forEach var="item" items="${list}" varStatus="status">
        <tr>
            <td>${status.count}</td>
            <td><c:out value="${item.name}"/></td>
            <td><c:out value="${item.value}"/></td>
        </tr>
        </c:forEach>
    </tbody>
</table>
```

## 📄 라이선스

MIT License

## 👤 제작자

**DongSeop Kim**
- Homepage: [https://karaf.io](https://karaf.io)
