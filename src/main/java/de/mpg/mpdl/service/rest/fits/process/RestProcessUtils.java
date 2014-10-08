package de.mpg.mpdl.service.rest.fits.process;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.commons.fileupload.FileItem;
import org.apache.commons.fileupload.FileUploadException;
import org.apache.commons.fileupload.disk.DiskFileItemFactory;
import org.apache.commons.fileupload.servlet.ServletFileUpload;
import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.io.ByteStreams;
import com.google.common.io.CharStreams;
import com.google.common.io.Closer;

import de.mpg.mpdl.service.rest.fits.ServiceConfiguration;
import de.mpg.mpdl.service.rest.fits.ServiceConfiguration.Pathes;

public class RestProcessUtils {

	private static final Logger LOGGER = LoggerFactory
			.getLogger(RestProcessUtils.class);

	private static final String JAVAX_SERVLET_CONTEXT_TEMPDIR = "javax.servlet.context.tempdir";
	private static final String FITS_VIEW_HTML_TEMPLATE_FILE_NAME = "viewer.html";
	private static final ServiceConfiguration config = new ServiceConfiguration();

	public static Response generateViewFromTextarea(String text)
			throws IOException {
		File f = File.createTempFile("fits", ".fits");
		FileUtils.writeStringToFile(f, text, "UTF-´8");
		return buildHtmlResponse(generateResponseHtml(f.getAbsolutePath()));
	}

	public static Response generateViewFromUrl(String url) throws IOException {
		File f = downloadFile(url);
		return buildHtmlResponse(generateResponseHtml(f.getAbsolutePath()));
	}

	public static Response generateViewFromFiles(HttpServletRequest request)
			throws IOException, FileUploadException {
		return buildHtmlResponse(generateHtmlFromFiles(request));
	}

	public static String generateHtmlFromFiles(HttpServletRequest request)
			throws FileUploadException, IOException {
		List<FileItem> fileItems = uploadFiles(request);
		LOGGER.info("files uploaded...");
		File file = File.createTempFile("fits", ".fits");
		ByteStreams.copy(getFirstFileItem(fileItems).getInputStream(),
				new FileOutputStream(file));
		return generateResponseHtml(file.getAbsolutePath());
	}

	public static Response generateThumbnailFromFiles(HttpServletRequest request)
			throws FileUploadException, IOException {
		return null;
	}

	public static Response generateThumbnailFromUrl(String url)
			throws IOException {
		return null;
	}

	public static Response generateThumbnailFromTextarea(String text)
			throws IOException {
		return null;
	}

	public static String generateResponseHtml(String filePath)
			throws IOException {
		//
		String chunk = getResourceAsString(FITS_VIEW_HTML_TEMPLATE_FILE_NAME);
		// replace other placeholders
		filePath = URLEncoder.encode(filePath, "UTF-8");
		return chunk.replace(
				"%FILE_URL_PLACEHOLDER%",
				config.getServiceUrl() + "/api" + Pathes.PATH_FILE + "?file="
						+ filePath).replace("%FITS_SERVICE_PLACEHOLDER%",
				config.getServiceUrl());
	}

	// Helpers
	public static List<FileItem> uploadFiles(HttpServletRequest request)
			throws FileUploadException {
		List<FileItem> items = null;
		if (ServletFileUpload.isMultipartContent(request)) {
			ServletContext servletContext = request.getServletContext();
			File repository = (File) servletContext
					.getAttribute(JAVAX_SERVLET_CONTEXT_TEMPDIR);
			DiskFileItemFactory factory = new DiskFileItemFactory();
			factory.setRepository(repository);
			ServletFileUpload fileUpload = new ServletFileUpload(factory);
			items = fileUpload.parseRequest(request);
		}
		return items;
	}

	public static File downloadFile(String url) throws MalformedURLException,
			IOException {
		URLConnection conn = URI.create(url).toURL().openConnection();
		File tmp = File.createTempFile("fits", ".fits");
		ByteStreams.copy(conn.getInputStream(), new FileOutputStream(tmp));
		return tmp;
	}

	public static Response readFile(String path) {
		File f = new File(path);
		return Response.status(Status.OK).entity(f)
				.type(MediaType.APPLICATION_OCTET_STREAM).build();
	}

	public static Response buildHtmlResponse(String str) {
		return buildHtmlResponse(str, Status.OK);
	}

	public static Response buildHtmlResponse(String str, Status status) {
		return Response.status(status).entity(str).type(MediaType.TEXT_HTML)
				.build();
	}

	public static Response buildJSONResponse(String str, Status status) {
		return Response.status(status).entity(str)
				.type(MediaType.APPLICATION_JSON).build();
	}

	public static String getResourceAsString(String fileName)
			throws IOException {
		return getInputStreamAsString(getResourceAsInputStream(fileName));
	}

	public static InputStream getResourceAsInputStream(String fileName)
			throws IOException {
		return new RestProcessUtils().getClass().getClassLoader()
				.getResourceAsStream(fileName);
	}

	public static URL getResourceAsURL(String fileName) throws IOException {
		return new RestProcessUtils().getClass().getClassLoader()
				.getResource(fileName);
	}

	private static String getInputStreamAsString(InputStream stream)
			throws IOException {
		Closer closer = Closer.create();
		closer.register(stream);
		String string = null;
		try {
			string = CharStreams.toString(new InputStreamReader(stream,
					StandardCharsets.UTF_8));
		} catch (Throwable e) {
			closer.rethrow(e);
		} finally {
			closer.close();
		}
		return string;
	}

	private static File getInputStreamAsFile(InputStream stream)
			throws IOException {
		Closer closer = Closer.create();
		closer.register(stream);
		File f = File.createTempFile("fits", ".fits");
		try {
			ByteStreams.copy(stream, new FileOutputStream(f));
		} catch (Throwable e) {
			closer.rethrow(e);
		} finally {
			closer.close();
		}
		return f;
	}

	// get only first processed file!
	public static FileItem getFirstFileItem(List<FileItem> fileItems)
			throws IOException {

		if (LOGGER.isDebugEnabled()) {
			for (FileItem fileItem : fileItems) {
				if (fileItem.isFormField()) {
					LOGGER.debug("fileItem.getFieldName():"
							+ fileItem.getFieldName());
					LOGGER.debug("value:" + fileItem.getString());
				}
			}
		}

		for (FileItem fileItem : fileItems) {
			if (!fileItem.isFormField()) {
				return fileItem;
			}
		}
		return null;
	}

}
