package de.mpg.mpdl.service.rest.fits;

import java.io.File;
import java.io.FileInputStream;
import java.util.Properties;

import org.apache.commons.io.FilenameUtils;

import de.mpg.mpdl.service.rest.fits.process.RestProcessUtils;

public class ServiceConfiguration {

	public class Pathes {
		public static final String PATH_EXPLAIN = "/explain";
		public static final String PATH_VIEW = "/view";
		public static final String PATH_THUMB = "/thumb";
		public static final String PATH_FILE = "/file";
	}

	public static final String SERVICE_NAME = "fits";
	private static final String PROPERTIES_FILENAME = "fits-service.properties";
	private Properties properties = new Properties();

	public ServiceConfiguration() {
		load();
	}

	public String getServiceUrl() {
		if (properties.containsKey("service.url"))
			return normalizeServiceUrl((String) properties.get("service.url"));
		return "http://localhost:8080/" + SERVICE_NAME;
	}

	private String normalizeServiceUrl(String url) {
		return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
	}

	public String getServiceApiUrl() {
		return getServiceUrl() + "/api";
	}

	public String getScreenshotServiceUrl() {
		if (properties.containsKey("screenshot.service.url"))
			return (String) properties.get("screenshot.service.url");
		return "http://localhost:8080/screenshot";
	}
	
	public String getImejiUrl() {
		if (properties.containsKey("imeji.service.url"))
			return (String) properties.get("imeji.service.url");
		return "http://localhost:8080";
	}
	

	/**
	 * Load the properties
	 */
	private void load() {

		String loc = "";
		try {
			if (System.getProperty("jboss.server.config.dir") != null) {
				loc = System.getProperty("jboss.server.config.dir");
			} else if (System.getProperty("catalina.home") != null) {
				loc = System.getProperty("catalina.home") + "/conf";
			} else {

				// if no app server is defined, take props from WEB-INF
				// (this is the test case)
				properties.load(RestProcessUtils
						.getResourceAsInputStream(PROPERTIES_FILENAME));
				return;
			}
			properties.load(new FileInputStream(new File(FilenameUtils.concat(
					loc, PROPERTIES_FILENAME))));

		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	

}
